import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Allow GET to check whether any admin exists (used by frontend to hide setup link)
  if (req.method === "GET") {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Missing Supabase environment variables");
      }
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
      const { data: existingAdmins, error: checkError } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("role", "admin")
        .limit(1);
      if (checkError) throw checkError;
      const exists = Array.isArray(existingAdmins) && existingAdmins.length > 0;
      return new Response(JSON.stringify({ exists }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (err: any) {
      console.error("Setup GET error:", err);
      return new Response(JSON.stringify({ error: err.message || "Error checking admin" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase environment variables");
    }
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { email, password, name } = body;
    
    if (!email || !password || !name) {
      throw new Error("Missing required fields: email, password, name");
    }

    // Check if any admin exists
    const { data: existingAdmins, error: checkError } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("role", "admin")
      .limit(1);
    
    if (checkError) {
      throw new Error(`Database check failed: ${checkError.message}`);
    }
    
    if (existingAdmins && existingAdmins.length > 0) {
      return new Response(
        JSON.stringify({ error: "Admin account already exists. Please use the login page." }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create admin user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    
    if (createError) {
      throw new Error(`Auth create failed: ${createError.message}`);
    }

    // Assign admin role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUser.user.id, role: "admin" });
    
    if (roleError) {
      throw new Error(`Role assignment failed: ${roleError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, user_id: newUser.user.id }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Setup error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "An unexpected error occurred during admin setup"
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
