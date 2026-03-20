import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => d * (Math.PI / 180);
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is authenticated staff
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    // Verify role is staff
    const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    if (!roleData || roleData.role !== "staff") throw new Error("Staff access required");

    // Verify staff account is active
    const { data: profile } = await supabaseAdmin.from("profiles").select("name, status").eq("user_id", user.id).maybeSingle();
    if (!profile || profile.status !== "active") throw new Error("Your account is inactive.");

    const { latitude, longitude, device_info, browser, operating_system, device_type } = await req.json();

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      throw new Error("Invalid coordinates.");
    }

    // Fetch school settings
    const { data: settings } = await supabaseAdmin.from("settings").select("*").limit(1).maybeSingle();
    if (!settings) throw new Error("School settings not configured.");

    // Server-side distance check
    const distance = getDistanceInMeters(latitude, longitude, settings.school_latitude, settings.school_longitude);
    if (distance > settings.allowed_radius) {
      return new Response(JSON.stringify({
        error: `You are ${Math.round(distance)}m away from school. Maximum allowed: ${settings.allowed_radius}m.`,
        distance: Math.round(distance),
        allowed: settings.allowed_radius,
      }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check for duplicate attendance today
    const today = new Date().toISOString().split("T")[0];
    const { data: existing } = await supabaseAdmin.from("attendance").select("id").eq("user_id", user.id).gte("created_at", today + "T00:00:00").lte("created_at", today + "T23:59:59").maybeSingle();
    if (existing) throw new Error("Attendance already marked for today.");

    // Determine present or late
    const now = new Date();
    const [lateHour, lateMin] = settings.late_time.split(":").map(Number);
    const lateThreshold = new Date();
    lateThreshold.setHours(lateHour, lateMin, 0, 0);
    const status = now > lateThreshold ? "late" : "present";

    // Insert attendance record
    const { data: record, error: insertError } = await supabaseAdmin.from("attendance").insert({
      user_id: user.id,
      staff_name: profile.name,
      latitude,
      longitude,
      status,
      device_info: device_info ?? null,
      browser: browser ?? null,
      operating_system: operating_system ?? null,
      device_type: device_type ?? null,
    }).select().single();

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ success: true, status, record }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
