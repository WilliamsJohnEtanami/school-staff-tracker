import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeEmail = (email: string | null | undefined) => (email ?? "").trim().toLowerCase();
const normalizeName = (name: string | null | undefined) =>
  (name ?? "").trim().replace(/\s+/g, " ").toLowerCase();

const splitName = (name: string) => {
  const trimmed = name.trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? trimmed;
  const lastName = parts.slice(1).join(" ") || "-";

  return { firstName, lastName };
};

const getSupabaseAdmin = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, serviceRoleKey);
};

const requireAdmin = async (
  req: Request,
  supabaseAdmin: ReturnType<typeof createClient>
) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("Unauthorized");
  }

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user: caller },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);

  if (authError || !caller) {
    throw new Error("Unauthorized");
  }

  const { data: roleData, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", caller.id)
    .eq("role", "admin")
    .maybeSingle();

  if (roleError) {
    throw new Error(roleError.message);
  }

  if (!roleData) {
    throw new Error("Admin access required");
  }

  return caller;
};

const findAuthUserByEmail = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string
) => {
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw new Error(`User lookup failed: ${error.message}`);
    }

    const matchingUser = data.users.find((user) => normalizeEmail(user.email) === email);

    if (matchingUser) {
      return matchingUser;
    }

    if (!data.nextPage || page >= data.lastPage) {
      return null;
    }

    page = data.nextPage;
  }
};

const ensureStaffRecords = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  name: string,
  email: string,
  department: string | null,
  shiftName: string | null
) => {
  const { firstName, lastName } = splitName(name);

  const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
    {
      user_id: userId,
      name,
      email,
      status: "active",
      department,
      shift_name: shiftName,
    },
    { onConflict: "user_id" }
  );

  if (profileError) {
    throw new Error(`Profile setup failed: ${profileError.message}`);
  }

  const { error: roleError } = await supabaseAdmin.from("user_roles").upsert(
    {
      user_id: userId,
      role: "staff",
    },
    { onConflict: "user_id,role" }
  );

  if (roleError) {
    throw new Error(`Role assignment failed: ${roleError.message}`);
  }

  const { error: staffError } = await supabaseAdmin.from("staff").upsert(
    {
      email,
      first_name: firstName,
      last_name: lastName,
      role: "staff",
    },
    { onConflict: "email" }
  );

  if (staffError) {
    throw new Error(`Legacy staff record setup failed: ${staffError.message}`);
  }

  const { error: contractError } = await supabaseAdmin.from("staff_contracts").upsert(
    {
      user_id: userId,
      contracted_hours: 8,
      grace_minutes: 15,
      effective_from: new Date().toISOString().split("T")[0],
    },
    { onConflict: "user_id" }
  );

  if (contractError) {
    throw new Error(`Contract setup failed: ${contractError.message}`);
  }
};

const deleteStaffAccount = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  confirmName: string
) => {
  if (!userId || !confirmName.trim()) {
    throw new Error("Staff account and confirmation name are required.");
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("user_id, name, email")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Unable to load staff profile: ${profileError.message}`);
  }

  if (!profile) {
    throw new Error("Staff profile not found.");
  }

  if (normalizeName(profile.name) !== normalizeName(confirmName)) {
    throw new Error("Confirmation name does not match the selected staff member.");
  }

  const { data: staffRole, error: staffRoleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "staff")
    .maybeSingle();

  if (staffRoleError) {
    throw new Error(`Unable to verify staff role: ${staffRoleError.message}`);
  }

  if (!staffRole) {
    throw new Error("Only staff accounts can be deleted here.");
  }

  const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (deleteAuthError) {
    throw new Error(`Failed to delete staff account: ${deleteAuthError.message}`);
  }

  const normalizedEmail = normalizeEmail(profile.email);

  if (normalizedEmail) {
    const { error: legacyStaffDeleteError } = await supabaseAdmin
      .from("staff")
      .delete()
      .eq("email", normalizedEmail);

    if (legacyStaffDeleteError) {
      console.warn("Legacy staff cleanup failed after auth delete:", legacyStaffDeleteError);
    }
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    await requireAdmin(req, supabaseAdmin);

    const { action, name, email, password, userId, confirmName, department, shiftName } = await req.json();
    const normalizedEmail = normalizeEmail(email);
    const trimmedName = typeof name === "string" ? name.trim() : "";
    const plainPassword = typeof password === "string" ? password : "";
    const trimmedDepartment = typeof department === "string" ? department.trim() : "";
    const trimmedShiftName = typeof shiftName === "string" ? shiftName.trim() : "";

    if (action === "create") {
      if (!trimmedName || !normalizedEmail || !plainPassword) {
        throw new Error("Name, email, and password are required.");
      }

      if (plainPassword.length < 6) {
        throw new Error("Password must be at least 6 characters long.");
      }

      const existingAuthUser = await findAuthUserByEmail(supabaseAdmin, normalizedEmail);
      let resolvedUserId: string;
      let recovered = false;

      if (existingAuthUser) {
        const { data: existingAdminRole } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", existingAuthUser.id)
          .eq("role", "admin")
          .maybeSingle();

        if (existingAdminRole) {
          throw new Error("That email address already belongs to an admin account.");
        }

        recovered = true;

        const { data: updatedUser, error: updateError } =
          await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, {
            password: plainPassword,
            email_confirm: true,
            user_metadata: {
              ...(existingAuthUser.user_metadata ?? {}),
              name: trimmedName,
            },
          });

        if (updateError) {
          throw new Error(`Failed to repair existing staff account: ${updateError.message}`);
        }

        resolvedUserId = updatedUser.user?.id ?? existingAuthUser.id;
      } else {
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: normalizedEmail,
          password: plainPassword,
          email_confirm: true,
          user_metadata: { name: trimmedName },
        });

        if (createError) {
          throw new Error(createError.message);
        }

        resolvedUserId = newUser.user.id;
      }

      await ensureStaffRecords(
        supabaseAdmin,
        resolvedUserId,
        trimmedName,
        normalizedEmail,
        trimmedDepartment || null,
        trimmedShiftName || null
      );

      return jsonResponse({ success: true, recovered, user_id: resolvedUserId });
    }

    if (action === "delete") {
      await deleteStaffAccount(
        supabaseAdmin,
        typeof userId === "string" ? userId : "",
        typeof confirmName === "string" ? confirmName : ""
      );

      return jsonResponse({ success: true, deleted: true, user_id: userId });
    }

    throw new Error("Unknown action");
  } catch (error: any) {
    console.error("Manage staff error:", error);
    return jsonResponse({ error: error.message || "Failed to manage staff" }, 400);
  }
});
