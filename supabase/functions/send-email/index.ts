import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"
import {
  buildEmailFromHeader,
  emailShouldDryRun,
  fetchBranchChannelSettings,
} from "../_shared/notification-channel-config.ts"

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

    const body = await req.json()
    const to = String(body.to ?? "").trim()
    const subject = String(body.subject ?? "").trim()
    const html = String(body.html ?? "").trim()
    const branchId = body.branch_id as string

    if (!to || !subject || !html || !branchId) {
      return new Response(JSON.stringify({ error: "to, subject, html, and branch_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: allowed, error: permError } = await supabaseUser.rpc("has_permission", {
      p_permission: "notifications.write",
      p_branch: branchId,
    })

    if (permError || !allowed) {
      return new Response(JSON.stringify({ error: "Permission denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const channelSettings = await fetchBranchChannelSettings(supabaseAdmin, branchId)
    const dryRun = emailShouldDryRun(channelSettings)
    const from = buildEmailFromHeader(channelSettings)
    const replyTo = channelSettings?.email_reply_to ?? undefined

    if (dryRun) {
      return new Response(
        JSON.stringify({
          success: true,
          dry_run: true,
          from_preview: from,
          message: "Email logged in dry-run mode — not sent to Resend.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const apiKey = Deno.env.get("RESEND_API_KEY")
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured on server" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        ...(replyTo ? { reply_to: [replyTo] } : {}),
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return new Response(JSON.stringify({ error: `Resend API error: ${text}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const resData = await res.json()

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: false,
        id: resData.id,
        from_preview: from,
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
