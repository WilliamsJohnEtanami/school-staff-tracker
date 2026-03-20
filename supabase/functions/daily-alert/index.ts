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

    // Fetch settings
    const { data: settings } = await supabase.from("settings").select("*").limit(1).maybeSingle();
    if (!settings?.alert_email) {
      return new Response(JSON.stringify({ message: "No alert email configured." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().split("T")[0];

    // Get all active staff
    const { data: allStaff } = await supabase.from("profiles").select("user_id, name").eq("status", "active");
    if (!allStaff?.length) {
      return new Response(JSON.stringify({ message: "No active staff." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get today's attendance
    const { data: todayAttendance } = await supabase.from("attendance").select("user_id").gte("created_at", today + "T00:00:00").lte("created_at", today + "T23:59:59");
    const presentIds = new Set((todayAttendance ?? []).map((a: any) => a.user_id));

    // Get staff on approved leave today
    const { data: onLeave } = await supabase.from("leave_requests").select("user_id").eq("status", "approved").lte("start_date", today).gte("end_date", today);
    const onLeaveIds = new Set((onLeave ?? []).map((l: any) => l.user_id));

    // Find absent staff (not present and not on leave)
    const absentStaff = allStaff.filter(s => !presentIds.has(s.user_id) && !onLeaveIds.has(s.user_id));

    if (!absentStaff.length) {
      return new Response(JSON.stringify({ message: "All staff accounted for. No alert sent." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const absentList = absentStaff.map(s => `<li>${s.name}</li>`).join("");
    const formattedDate = new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    const html = `
      <h2>Attendance Alert — ${formattedDate}</h2>
      <p>The following staff members have not clocked in today:</p>
      <ul>${absentList}</ul>
      <p>Total absent: <strong>${absentStaff.length}</strong> of <strong>${allStaff.length}</strong> active staff.</p>
      <p style="color:#888;font-size:12px;">This is an automated alert from your Staff Attendance System.</p>
    `;

    // Send email via Resend
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Staff Attendance <alerts@yourdomain.com>",
        to: [settings.alert_email],
        subject: `Attendance Alert: ${absentStaff.length} staff absent — ${formattedDate}`,
        html,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.text();
      throw new Error(`Email send failed: ${err}`);
    }

    return new Response(JSON.stringify({ message: `Alert sent. ${absentStaff.length} staff absent.` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
