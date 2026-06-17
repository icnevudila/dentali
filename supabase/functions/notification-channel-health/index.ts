import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser()

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const body = await req.json().catch(() => ({}))
    const branchId = body.branch_id ? String(body.branch_id) : null

    if (branchId) {
      const { data: allowed, error: permError } = await supabaseUser.rpc("has_permission", {
        p_permission: "notifications.read",
        p_branch: branchId,
      })
      if (permError || !allowed) {
        return new Response(JSON.stringify({ error: "Permission denied" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
    }

    const smsConfigured = Boolean(Deno.env.get("SEMAPHORE_API_KEY")?.trim())
    const emailConfigured = Boolean(Deno.env.get("RESEND_API_KEY")?.trim())

    return new Response(
      JSON.stringify({
        sms: {
          provider: "Semaphore",
          configured: smsConfigured,
          secret_name: "SEMAPHORE_API_KEY",
          optional_secret: "SEMAPHORE_SENDER_NAME",
        },
        email: {
          provider: "Resend",
          configured: emailConfigured,
          secret_name: "RESEND_API_KEY",
          optional_secret: "CLOSEOUT_EMAIL_FROM",
        },
        whatsapp: {
          mode: "manual",
          configured: true,
          cost: "free",
          note: "Uses wa.me links — no API key required.",
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
