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

const getStaffUserIds = async (supabaseAdmin: ReturnType<typeof createClient>) => {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "staff");

  if (error) {
    throw new Error(`Unable to load staff roles: ${error.message}`);
  }

  return (data ?? []).map((row) => row.user_id);
};

const insertNotification = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  title: string,
  message: string,
  createdBy: string
) => {
  const { error } = await supabaseAdmin.from("notifications").insert({
    title,
    message,
    created_by: createdBy,
  });

  if (error) {
    throw new Error(`Failed to create notification: ${error.message}`);
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
    const adminUser = await requireAdmin(req, supabaseAdmin);
    const { type } = await req.json();

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      throw new Error(`Unable to load reminder settings: ${settingsError.message}`);
    }

    if (!settings) {
      return jsonResponse({ success: true, message: "Settings are not configured yet." });
    }

    const today = new Date().toISOString().split("T")[0];
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastWeekKey = lastWeek.toISOString().split("T")[0];
    const staffUserIds = await getStaffUserIds(supabaseAdmin);

    if (type === "clock_in_reminders") {
      if (!settings.clock_in_reminder) {
        return jsonResponse({ success: true, message: "Clock-in reminders are currently disabled in settings." });
      }

      if (staffUserIds.length === 0) {
        return jsonResponse({ success: true, message: "No staff accounts exist yet." });
      }

      const { data: activeStaff, error: staffError } = await supabaseAdmin
        .from("profiles")
        .select("user_id, name")
        .in("user_id", staffUserIds)
        .eq("status", "active");

      if (staffError) {
        throw new Error(`Unable to load active staff: ${staffError.message}`);
      }

      if (!activeStaff?.length) {
        return jsonResponse({ success: true, message: "No active staff need reminders right now." });
      }

      const { data: todayAttendance, error: attendanceError } = await supabaseAdmin
        .from("attendance")
        .select("user_id")
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`);

      if (attendanceError) {
        throw new Error(`Unable to load today's attendance: ${attendanceError.message}`);
      }

      const { data: approvedLeave, error: leaveError } = await supabaseAdmin
        .from("leave_requests")
        .select("user_id")
        .eq("status", "approved")
        .lte("start_date", today)
        .gte("end_date", today);

      if (leaveError) {
        throw new Error(`Unable to load approved leave requests: ${leaveError.message}`);
      }

      const presentIds = new Set((todayAttendance ?? []).map((row) => row.user_id));
      const onLeaveIds = new Set((approvedLeave ?? []).map((row) => row.user_id));
      const needingReminder = activeStaff.filter(
        (staff) => !presentIds.has(staff.user_id) && !onLeaveIds.has(staff.user_id)
      );

      if (needingReminder.length === 0) {
        return jsonResponse({ success: true, message: "Everyone is already accounted for today." });
      }

      await insertNotification(
        supabaseAdmin,
        "Clock-in Reminder",
        `${needingReminder.length} staff member(s) still need to clock in today.`,
        adminUser.id
      );

      return jsonResponse({
        success: true,
        message: `Clock-in reminder sent for ${needingReminder.length} staff member(s).`,
        sentTo: needingReminder.length,
      });
    }

    if (type === "clock_out_reminders") {
      if (!settings.clock_out_reminder) {
        return jsonResponse({ success: true, message: "Clock-out reminders are currently disabled in settings." });
      }

      const { data: activeSessions, error: sessionError } = await supabaseAdmin
        .from("work_sessions")
        .select("user_id")
        .eq("session_date", today)
        .eq("type", "work")
        .is("ended_at", null);

      if (sessionError) {
        throw new Error(`Unable to load active work sessions: ${sessionError.message}`);
      }

      const openSessions = Array.from(new Set((activeSessions ?? []).map((row) => row.user_id)));

      if (openSessions.length === 0) {
        return jsonResponse({ success: true, message: "No staff currently need a clock-out reminder." });
      }

      await insertNotification(
        supabaseAdmin,
        "Clock-out Reminder",
        `${openSessions.length} staff member(s) still have an active work session and should clock out.`,
        adminUser.id
      );

      return jsonResponse({
        success: true,
        message: `Clock-out reminder sent for ${openSessions.length} staff member(s).`,
        sentTo: openSessions.length,
      });
    }

    if (type === "weekly_reports") {
      if (!settings.weekly_reports) {
        return jsonResponse({ success: true, message: "Weekly reports are currently disabled in settings." });
      }

      const { data: weeklyAttendance, error: weeklyError } = await supabaseAdmin
        .from("attendance")
        .select("user_id")
        .gte("created_at", `${lastWeekKey}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`);

      if (weeklyError) {
        throw new Error(`Unable to build weekly report: ${weeklyError.message}`);
      }

      const totalCheckIns = weeklyAttendance?.length ?? 0;
      const uniqueStaff = new Set((weeklyAttendance ?? []).map((row) => row.user_id)).size;

      await insertNotification(
        supabaseAdmin,
        "Weekly Attendance Report",
        `Weekly summary: ${totalCheckIns} attendance record(s) across ${uniqueStaff} staff member(s).`,
        adminUser.id
      );

      return jsonResponse({
        success: true,
        message: "Weekly attendance report generated successfully.",
      });
    }

    if (type === "pending_leave_reminders") {
      const { data: pendingRequests, error: pendingError } = await supabaseAdmin
        .from("leave_requests")
        .select("id")
        .eq("status", "pending");

      if (pendingError) {
        throw new Error(`Unable to load pending leave requests: ${pendingError.message}`);
      }

      const count = pendingRequests?.length ?? 0;

      if (count === 0) {
        return jsonResponse({ success: true, message: "There are no pending leave requests right now." });
      }

      await insertNotification(
        supabaseAdmin,
        "Pending Leave Requests",
        `There are ${count} pending leave request(s) awaiting review.`,
        adminUser.id
      );

      return jsonResponse({
        success: true,
        message: `Pending leave reminder created for ${count} request(s).`,
        sentTo: count,
      });
    }

    return jsonResponse({ error: "Unknown reminder type." }, 400);
  } catch (error: any) {
    console.error("Reminders edge function error:", error);
    return jsonResponse(
      {
        success: false,
        error: error.message || "An unexpected error occurred.",
      },
      400
    );
  }
});
