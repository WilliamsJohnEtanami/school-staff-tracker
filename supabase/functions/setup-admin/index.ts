import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

const normalizeEmail = (email: string | null | undefined) => (email ?? "").trim().toLowerCase();

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

const getSupabaseAdmin = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, serviceRoleKey);
};

const getExistingAdminUserId = async (supabaseAdmin: ReturnType<typeof createClient>) => {
  const { data: existingAdmins, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1);

  if (error) {
    throw new Error(`Database check failed: ${error.message}`);
  }

  return existingAdmins?.[0]?.user_id ?? null;
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

const ensureAdminRecords = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  name: string,
  email: string
) => {
  const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
    {
      user_id: userId,
      name,
      email,
      status: "active",
    },
    { onConflict: "user_id" }
  );

  if (profileError) {
    throw new Error(`Profile repair failed: ${profileError.message}`);
  }

  const { error: roleError } = await supabaseAdmin.from("user_roles").upsert(
    {
      user_id: userId,
      role: "admin",
    },
    { onConflict: "user_id,role" }
  );

  if (roleError) {
    throw new Error(`Role assignment failed: ${roleError.message}`);
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === "GET") {
    try {
      const supabaseAdmin = getSupabaseAdmin();
      const exists = Boolean(await getExistingAdminUserId(supabaseAdmin));
      return jsonResponse({ exists });
    } catch (err: any) {
      console.error("Setup GET error:", err);
      return jsonResponse({ error: err.message || "Error checking admin" }, 500);
    }
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

    const body = await req.json();
    const email = normalizeEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!email || !password || !name) {
      throw new Error("Missing required fields: email, password, name");
    }

    const existingAdminUserId = await getExistingAdminUserId(supabaseAdmin);
    const existingAuthUser = await findAuthUserByEmail(supabaseAdmin, email);

    if (existingAdminUserId) {
      return jsonResponse(
        { error: "Admin account already exists. Please use the login page." },
        409
      );
    }

    let userId: string;
    let recovered = false;

    if (existingAuthUser) {
      recovered = true;

      const { data: updatedUser, error: updateError } =
        await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, {
          password,
          email_confirm: true,
          user_metadata: {
            ...(existingAuthUser.user_metadata ?? {}),
            name,
          },
        });

      if (updateError) {
        throw new Error(`Admin repair failed: ${updateError.message}`);
      }

      userId = updatedUser.user?.id ?? existingAuthUser.id;
    } else {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });

      if (createError) {
        throw new Error(`Auth create failed: ${createError.message}`);
      }

      userId = newUser.user.id;
    }

    await ensureAdminRecords(supabaseAdmin, userId, name, email);

    return jsonResponse({ success: true, recovered, user_id: userId });
  } catch (error: any) {
    console.error("Setup error:", error);
    return jsonResponse(
      {
        error: error.message || "An unexpected error occurred during admin setup",
      },
      400
    );
  }
});
