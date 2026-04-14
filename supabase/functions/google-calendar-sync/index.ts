import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

async function refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  return res.json();
}

async function getValidToken(supabase: any, userId: string, clientId: string, clientSecret: string) {
  const { data: tokenRow, error } = await supabase
    .from("google_calendar_tokens")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !tokenRow) throw new Error("Google Calendar not connected. Please connect in Settings.");

  const expiry = tokenRow.token_expiry ? new Date(tokenRow.token_expiry) : null;
  const isExpired = !expiry || expiry <= new Date(Date.now() + 60000);

  if (isExpired && tokenRow.refresh_token) {
    const refreshed = await refreshAccessToken(tokenRow.refresh_token, clientId, clientSecret);
    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await supabase.from("google_calendar_tokens").update({
      access_token: refreshed.access_token,
      token_expiry: newExpiry,
    }).eq("user_id", userId);
    return { accessToken: refreshed.access_token, calendarId: tokenRow.calendar_id };
  }

  return { accessToken: tokenRow.access_token, calendarId: tokenRow.calendar_id };
}

async function googleFetch(url: string, accessToken: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google API error ${res.status}: ${text}`);
  }
  return res.status === 204 ? null : res.json();
}

function toGoogleEvent(event: any) {
  return {
    summary: event.event_name,
    description: `Type: ${event.type}${event.expected_hours ? ` | Expected hours: ${event.expected_hours}` : ""}`,
    start: { date: event.event_date },
    end: { date: event.event_date },
    colorId: event.type === "holiday" ? "11" : event.type === "early_closure" ? "5" : event.type === "no_school" ? "10" : "1",
    extendedProperties: {
      private: {
        schoolEventType: event.type,
        schoolEventId: event.id,
      },
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    if (roleData?.role !== "admin") throw new Error("Admin access required");

    const { action, code, redirectUri } = await req.json();

    // --- OAuth exchange ---
    if (action === "exchange_code") {
      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      if (!tokenRes.ok) throw new Error(`OAuth exchange failed: ${await tokenRes.text()}`);
      const tokens = await tokenRes.json();

      // Get or create a dedicated school calendar
      const calListRes = await googleFetch(`${GOOGLE_CALENDAR_API}/users/me/calendarList`, tokens.access_token);
      let calendarId = calListRes?.items?.find((c: any) => c.summary === "School Attendance")?.id;

      if (!calendarId) {
        const newCal = await googleFetch(`${GOOGLE_CALENDAR_API}/calendars`, tokens.access_token, {
          method: "POST",
          body: JSON.stringify({ summary: "School Attendance", description: "Synced from School Staff Tracker" }),
        });
        calendarId = newCal.id;
      }

      await supabase.from("google_calendar_tokens").upsert({
        user_id: user.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        calendar_id: calendarId,
      }, { onConflict: "user_id" });

      return new Response(JSON.stringify({ success: true, calendarId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Sync ---
    if (action === "sync") {
      const { accessToken, calendarId } = await getValidToken(supabase, user.id, clientId, clientSecret);
      if (!calendarId) throw new Error("No Google Calendar linked. Please reconnect.");

      // Fetch all school calendar events
      const { data: schoolEvents } = await supabase.from("school_calendar").select("*");
      if (!schoolEvents?.length) {
        return new Response(JSON.stringify({ success: true, message: "No events to sync." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch existing Google events with our extendedProperties
      const googleEventsRes = await googleFetch(
        `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?privateExtendedProperty=schoolEventId&maxResults=2500`,
        accessToken
      );
      const googleEvents: any[] = googleEventsRes?.items ?? [];
      const googleEventsBySchoolId = new Map(
        googleEvents
          .filter(e => e.extendedProperties?.private?.schoolEventId)
          .map(e => [e.extendedProperties.private.schoolEventId, e])
      );

      let created = 0, updated = 0;

      for (const event of schoolEvents) {
        const googleEvent = toGoogleEvent(event);
        const existing = googleEventsBySchoolId.get(event.id);

        if (existing) {
          // Update if name or date changed
          if (existing.summary !== event.event_name || existing.start?.date !== event.event_date) {
            await googleFetch(
              `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${existing.id}`,
              accessToken,
              { method: "PUT", body: JSON.stringify(googleEvent) }
            );
            updated++;
          }
        } else {
          // Create new
          const created_event = await googleFetch(
            `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
            accessToken,
            { method: "POST", body: JSON.stringify(googleEvent) }
          );
          // Store google_event_id back on our record
          await supabase.from("school_calendar").update({ google_event_id: created_event.id }).eq("id", event.id);
          created++;
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Sync complete. ${created} created, ${updated} updated.`,
        created,
        updated,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- Disconnect ---
    if (action === "disconnect") {
      await supabase.from("google_calendar_tokens").delete().eq("user_id", user.id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Status check ---
    if (action === "status") {
      const { data: tokenRow } = await supabase.from("google_calendar_tokens").select("calendar_id, token_expiry").eq("user_id", user.id).maybeSingle();
      return new Response(JSON.stringify({ connected: !!tokenRow, calendarId: tokenRow?.calendar_id ?? null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Unknown action");
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
