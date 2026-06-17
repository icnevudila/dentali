import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"
import { sendOrgLiveSms } from "../_shared/provider-secrets.ts"

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
    const phone = String(body.phone ?? "").trim()
    const messageBody = String(body.body ?? "").trim()
    const branchId = body.branch_id as string
    const templateKey = body.template_key ? String(body.template_key) : null
    const patientId = body.patient_id ? String(body.patient_id) : null

    if (!phone || !messageBody || !branchId) {
      return new Response(JSON.stringify({ error: "phone, body, and branch_id are required" }), {
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

    const { data: profile } = await supabaseUser
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle()

    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ error: "Organization not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: branchSettings } = await supabaseAdmin
      .from("notification_branch_settings")
      .select("dry_run_mode")
      .eq("branch_id", branchId)
      .maybeSingle()

    const dryRun = branchSettings?.dry_run_mode ?? true
    let status = dryRun ? "dry_run" : "sent"
    let providerRef: string | null = null
    let errorMessage: string | null = null

    if (!dryRun) {
      const smsResult = await sendOrgLiveSms(supabaseAdmin, {
        organizationId: profile.organization_id,
        branchId,
        phone,
        message: messageBody,
      })
      if (smsResult.ok) {
        providerRef = smsResult.providerRef
      } else {
        status = "failed"
        errorMessage = smsResult.error
      }
    }

    const { data: logRow, error: insertError } = await supabaseAdmin
      .from("notification_logs")
      .insert({
        organization_id: profile.organization_id,
        branch_id: branchId,
        patient_id: patientId,
        template_key: templateKey,
        recipient_phone: phone,
        body_preview: messageBody.slice(0, 500),
        status,
        provider_ref: providerRef,
        error_message: errorMessage,
        created_by: user.id,
      })
      .select("id")
      .single()

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (status === "failed") {
      return new Response(
        JSON.stringify({ error: errorMessage ?? "SMS send failed", log_id: logRow.id, status }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        log_id: logRow.id,
        status,
        dry_run: dryRun,
        provider_ref: providerRef,
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
