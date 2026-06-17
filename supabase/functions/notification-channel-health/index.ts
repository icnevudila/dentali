import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"
import { resolveResendApiKey, resolveSemaphoreApiKey } from "../_shared/provider-secrets.ts"

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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

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

    if (!branchId) {
      return new Response(JSON.stringify({ error: "branch_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

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

    const { data: branch } = await supabaseAdmin
      .from("branches")
      .select("organization_id")
      .eq("id", branchId)
      .maybeSingle()

    if (!branch?.organization_id) {
      return new Response(JSON.stringify({ error: "Branch not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const [smsKey, resendKey] = await Promise.all([
      resolveSemaphoreApiKey(supabaseAdmin, branch.organization_id),
      resolveResendApiKey(supabaseAdmin, branch.organization_id),
    ])

    return new Response(
      JSON.stringify({
        sms: {
          provider: "Semaphore",
          configured: Boolean(smsKey),
          source: smsKey ? (Deno.env.get("SEMAPHORE_API_KEY") === smsKey ? "env" : "settings") : "none",
          secret_name: "SEMAPHORE_API_KEY",
        },
        email: {
          provider: "Resend",
          configured: Boolean(resendKey),
          source: resendKey ? (Deno.env.get("RESEND_API_KEY") === resendKey ? "env" : "settings") : "none",
          secret_name: "RESEND_API_KEY",
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
