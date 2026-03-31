import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { type } = await req.json();

    // Fetch settings
    const { data: settings } = await supabase.from("settings").select("*").limit(1).maybeSingle();
    if (!settings) {
      return new Response(JSON.stringify({ message: "Settings not configured." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().split("T")[0];
    const now = new Date();

    if (type === "clock_in_reminders" && settings.clock_in_reminder) {
      // Send clock-in reminders to staff who haven't clocked in yet
      const reminderTime = settings.reminder_time || "09:00";
      const [hours, minutes] = reminderTime.split(":").map(Number);
      const reminderDateTime = new Date();
      reminderDateTime.setHours(hours, minutes, 0, 0);

      // Only send if current time is past reminder time
      if (now >= reminderDateTime) {
        const { data: allStaff } = await supabase
          .from("profiles")
          .select("user_id, name")
          .eq("status", "active");

        if (!allStaff?.length) {
          return new Response(JSON.stringify({ message: "No active staff." }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get today's attendance
        const { data: todayAttendance } = await supabase
          .from("attendance")
          .select("user_id")
          .gte("created_at", today + "T00:00:00")
          .lte("created_at", today + "T23:59:59");

        const presentIds = new Set((todayAttendance ?? []).map((a: any) => a.user_id));

        // Get staff on approved leave today
        const { data: onLeave } = await supabase
          .from("leave_requests")
          .select("user_id")
          .eq("status", "approved")
          .lte("start_date", today)
          .gte("end_date", today);

        const onLeaveIds = new Set((onLeave ?? []).map((l: any) => l.user_id));

        // Find staff who need reminders (not present, not on leave)
        const staffNeedingReminders = allStaff.filter(
          s => !presentIds.has(s.user_id) && !onLeaveIds.has(s.user_id)
        );

        if (staffNeedingReminders.length > 0) {
          // Create in-app notifications for each staff member using service role to bypass RLS
          const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
          const notifications = staffNeedingReminders.map(staff => ({
            title: "Clock-in Reminder",
            message: `Don't forget to clock in for today's attendance. It's currently ${now.toLocaleTimeString()}.`,
            created_by: null,
          }));

          const { error: notifError } = await supabaseAdmin
            .from("notifications")
            .insert(notifications);

          if (notifError) {
            console.error("Failed to create notifications:", notifError, notifError.message);
          }
        }

        return new Response(JSON.stringify({
          success: true,
          message: `Clock-in reminders sent to ${staffNeedingReminders.length} staff members.`,
          sentTo: staffNeedingReminders.length
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (type === "clock_out_reminders" && settings.clock_out_reminder) {
      // Send clock-out reminders to staff who are still clocked in at end of day
      const endOfDay = new Date();
      endOfDay.setHours(17, 0, 0, 0); // 5 PM

      if (now >= endOfDay) {
        // Get staff who are currently clocked in (have work sessions without end time)
        const { data: activeSessions } = await supabase
          .from("work_sessions")
          .select(`
            user_id,
            profiles!inner(name)
          `)
          .is("ended_at", null)
          .eq("type", "work");

        if (activeSessions && activeSessions.length > 0) {
          const notifications = activeSessions.map((session: any) => ({
            title: "Clock-out Reminder",
            message: `Please remember to clock out before leaving. Your work session is still active.`,
            created_by: null,
          }));

          const { error: notifError } = await supabase
            .from("notifications")
            .insert(notifications);

          if (notifError) {
            console.error("Failed to create notifications:", notifError);
          }

          return new Response(JSON.stringify({
            message: `Clock-out reminders sent to ${activeSessions.length} staff members.`
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    if (type === "weekly_reports" && settings.weekly_reports) {
      // Send weekly attendance summary reports
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

      // Send on Fridays (5)
      if (dayOfWeek === 5) {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 7);
        const weekStartStr = weekStart.toISOString().split("T")[0];

        // Get weekly attendance stats
        const { data: weeklyAttendance } = await supabase
          .from("attendance")
          .select(`
            user_id,
            created_at,
            profiles!inner(name)
          `)
          .gte("created_at", weekStartStr + "T00:00:00")
          .lte("created_at", today + "T23:59:59");

        // Calculate stats
        const totalCheckIns = weeklyAttendance?.length || 0;
        const uniqueStaff = new Set(weeklyAttendance?.map((a: any) => a.user_id)).size;

        // Create admin notification
        const { error: notifError } = await supabase
          .from("notifications")
          .insert({
            title: "Weekly Attendance Report",
            message: `This week's summary: ${totalCheckIns} check-ins from ${uniqueStaff} staff members.`,
            created_by: null,
          });

        if (notifError) {
          console.error("Failed to create weekly report notification:", notifError);
        }

        return new Response(JSON.stringify({
          message: "Weekly attendance report generated."
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (type === "pending_leave_reminders") {
      // Remind admin about pending leave requests
      const { data: pendingRequests } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("status", "pending");

      if (pendingRequests && pendingRequests.length > 0) {
        const { error: notifError } = await supabase
          .from("notifications")
          .insert({
            title: "Pending Leave Requests",
            message: `There are ${pendingRequests.length} pending leave requests awaiting your approval.`,
            created_by: null,
          });

        if (notifError) {
          console.error("Failed to create pending leave notification:", notifError);
        }

        return new Response(JSON.stringify({
          message: `Reminder sent for ${pendingRequests.length} pending leave requests.`
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ message: "No reminders needed at this time." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Reminders edge function error:", error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message || "An unexpected error occurred" 
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});