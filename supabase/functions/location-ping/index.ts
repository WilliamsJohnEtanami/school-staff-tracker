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
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    const { session_id, latitude, longitude, location_available } = await req.json();

    // Fetch school settings for distance check
    const { data: settings } = await supabase.from("settings").select("school_latitude, school_longitude, allowed_radius").limit(1).maybeSingle();

    let distance_from_school: number | null = null;
    let is_outside_radius = false;

    if (settings && location_available && latitude !== 0) {
      distance_from_school = getDistanceInMeters(latitude, longitude, settings.school_latitude, settings.school_longitude);
      is_outside_radius = distance_from_school > settings.allowed_radius;
    }

    // Insert ping record
    const { error: insertError } = await supabase.from("location_pings").insert({
      user_id: user.id,
      session_id: session_id ?? null,
      latitude,
      longitude,
      distance_from_school,
      is_outside_radius,
      location_available,
    });

    if (insertError) throw insertError;

    return new Response(JSON.stringify({
      success: true,
      is_outside_radius,
      distance_from_school: distance_from_school ? Math.round(distance_from_school) : null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
