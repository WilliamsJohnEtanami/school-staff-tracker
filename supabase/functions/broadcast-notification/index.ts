import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const isMissingNotificationsTable = (error: { code?: string; message?: string } | null | undefined) => {
  const message = (error?.message ?? "").toLowerCase();

  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    message.includes(`relation "public.notifications" does not exist`) ||
    message.includes(`could not find the table 'public.notifications' in the schema cache`) ||
    message.includes(`could not find table 'public.notifications' in the schema cache`)
  );
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

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
      throw roleError;
    }

    if (!roleData) {
      throw new Error("Admin access required");
    }

    const { title, message } = await req.json();

    if (!title?.trim() || !message?.trim()) {
      throw new Error("Title and message are required.");
    }

    const { error: insertError } = await supabaseAdmin.from("notifications").insert({
      title: title.trim(),
      message: message.trim(),
      created_by: user.id,
    });

    if (insertError) {
      if (isMissingNotificationsTable(insertError)) {
        throw new Error(
          "Notifications table is missing from the database schema. Run `supabase db push` and redeploy your edge functions."
        );
      }

      throw insertError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Broadcast notification sent successfully.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: error.message || "Failed to send broadcast notification.",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
