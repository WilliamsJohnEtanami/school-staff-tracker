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

type AudienceType =
  | "all"
  | "specific_staff"
  | "department"
  | "late_today"
  | "absent_today"
  | "shift";

type StaffProfileRow = {
  user_id: string;
  name: string;
  email: string;
  status: string;
  department: string | null;
  shift_name: string | null;
};

const normalizeText = (value: string | null | undefined) =>
  (value ?? "").trim().toLowerCase();

const normalizeList = (values: unknown): string[] =>
  Array.isArray(values)
    ? values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    : [];

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
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const { data: roleData, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (roleError) {
    throw new Error(roleError.message);
  }

  if (!roleData) {
    throw new Error("Admin access required");
  }

  return user;
};

const getActiveStaffProfiles = async (supabaseAdmin: ReturnType<typeof createClient>) => {
  const [{ data: profiles, error: profilesError }, { data: roles, error: rolesError }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("user_id, name, email, status, department, shift_name")
      .eq("status", "active"),
    supabaseAdmin.from("user_roles").select("user_id").eq("role", "staff"),
  ]);

  if (profilesError) {
    throw new Error(`Unable to load staff profiles: ${profilesError.message}`);
  }

  if (rolesError) {
    throw new Error(`Unable to load staff roles: ${rolesError.message}`);
  }

  const staffRoleIds = new Set((roles ?? []).map((row) => row.user_id));

  return ((profiles ?? []) as StaffProfileRow[]).filter((profile) => staffRoleIds.has(profile.user_id));
};

const getTodayLateUserIds = async (supabaseAdmin: ReturnType<typeof createClient>) => {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabaseAdmin
    .from("attendance")
    .select("user_id")
    .eq("status", "late")
    .gte("timestamp", `${today}T00:00:00`)
    .lte("timestamp", `${today}T23:59:59`);

  if (error) {
    throw new Error(`Unable to load today's late staff: ${error.message}`);
  }

  return new Set((data ?? []).map((row) => row.user_id));
};

const getTodayAbsentUserIds = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  staffProfiles: StaffProfileRow[]
) => {
  const today = new Date().toISOString().split("T")[0];

  const [{ data: attendanceRows, error: attendanceError }, { data: leaveRows, error: leaveError }] =
    await Promise.all([
      supabaseAdmin
        .from("attendance")
        .select("user_id, status")
        .gte("timestamp", `${today}T00:00:00`)
        .lte("timestamp", `${today}T23:59:59`),
      supabaseAdmin
        .from("leave_requests")
        .select("user_id")
        .eq("status", "approved")
        .lte("start_date", today)
        .gte("end_date", today),
    ]);

  if (attendanceError) {
    throw new Error(`Unable to load today's attendance: ${attendanceError.message}`);
  }

  if (leaveError) {
    throw new Error(`Unable to load today's leave data: ${leaveError.message}`);
  }

  const clockedInIds = new Set(
    (attendanceRows ?? [])
      .filter((row) => row.status === "present" || row.status === "late")
      .map((row) => row.user_id)
  );

  const onLeaveIds = new Set((leaveRows ?? []).map((row) => row.user_id));

  return new Set(
    staffProfiles
      .filter((profile) => !clockedInIds.has(profile.user_id) && !onLeaveIds.has(profile.user_id))
      .map((profile) => profile.user_id)
  );
};

const resolveAudience = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  audienceType: AudienceType,
  staffUserIds: string[],
  departments: string[],
  shifts: string[]
) => {
  const activeStaffProfiles = await getActiveStaffProfiles(supabaseAdmin);

  let recipients: StaffProfileRow[] = [];
  let summary = "All active staff";

  if (audienceType === "all") {
    recipients = activeStaffProfiles;
  } else if (audienceType === "specific_staff") {
    if (staffUserIds.length === 0) {
      throw new Error("Select at least one staff member.");
    }

    const selectedIds = new Set(staffUserIds);
    recipients = activeStaffProfiles.filter((profile) => selectedIds.has(profile.user_id));
    summary = recipients.length === 1 ? recipients[0].name : `${recipients.length} selected staff`;
  } else if (audienceType === "department") {
    if (departments.length === 0) {
      throw new Error("Select at least one department.");
    }

    const normalizedDepartments = new Set(departments.map(normalizeText));
    recipients = activeStaffProfiles.filter((profile) =>
      normalizedDepartments.has(normalizeText(profile.department))
    );
    summary =
      departments.length === 1
        ? `${departments[0]} department`
        : `${departments.length} departments`;
  } else if (audienceType === "shift") {
    if (shifts.length === 0) {
      throw new Error("Select at least one shift.");
    }

    const normalizedShifts = new Set(shifts.map(normalizeText));
    recipients = activeStaffProfiles.filter((profile) =>
      normalizedShifts.has(normalizeText(profile.shift_name))
    );
    summary = shifts.length === 1 ? `${shifts[0]} shift` : `${shifts.length} shifts`;
  } else if (audienceType === "late_today") {
    const lateIds = await getTodayLateUserIds(supabaseAdmin);
    recipients = activeStaffProfiles.filter((profile) => lateIds.has(profile.user_id));
    summary = "Staff marked late today";
  } else if (audienceType === "absent_today") {
    const absentIds = await getTodayAbsentUserIds(supabaseAdmin, activeStaffProfiles);
    recipients = activeStaffProfiles.filter((profile) => absentIds.has(profile.user_id));
    summary = "Staff absent today";
  }

  const uniqueRecipients = Array.from(
    new Map(recipients.map((recipient) => [recipient.user_id, recipient])).values()
  );

  if (uniqueRecipients.length === 0) {
    throw new Error("No staff matched that audience.");
  }

  return {
    recipients: uniqueRecipients,
    summary,
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const adminUser = await requireAdmin(req, supabaseAdmin);

    const body = await req.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const audienceType = (typeof body.audienceType === "string" ? body.audienceType : "all") as AudienceType;
    const staffUserIds = normalizeList(body.staffUserIds);
    const departments = normalizeList(body.departments);
    const shifts = normalizeList(body.shifts);

    if (!title || !message) {
      throw new Error("Title and message are required.");
    }

    const { recipients, summary } = await resolveAudience(
      supabaseAdmin,
      audienceType,
      staffUserIds,
      departments,
      shifts
    );

    const { data: notification, error: insertError } = await supabaseAdmin
      .from("notifications")
      .insert({
        title,
        message,
        created_by: adminUser.id,
        audience_type: audienceType,
        audience_summary: summary,
        recipient_count: recipients.length,
      })
      .select("id")
      .single();

    if (insertError) {
      throw new Error(`Failed to create notification: ${insertError.message}`);
    }

    const { error: recipientError } = await supabaseAdmin.from("notification_recipients").insert(
      recipients.map((recipient) => ({
        notification_id: notification.id,
        user_id: recipient.user_id,
      }))
    );

    if (recipientError) {
      throw new Error(`Failed to attach notification recipients: ${recipientError.message}`);
    }

    return jsonResponse({
      success: true,
      message: `Notification sent to ${recipients.length} staff member${recipients.length === 1 ? "" : "s"}.`,
      recipientCount: recipients.length,
      audienceSummary: summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send broadcast notification.";

    return jsonResponse(
      {
        error: message,
      },
      400
    );
  }
});
