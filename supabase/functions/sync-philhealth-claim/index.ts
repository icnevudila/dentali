import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"
import { submitPhilHealthClaim } from "../_shared/philhealth-provider.ts"

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
    const claimId = String(body.claim_id ?? "").trim()

    if (!claimId) {
      return new Response(JSON.stringify({ error: "claim_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: claim, error: claimError } = await supabaseUser
      .from("philhealth_claims")
      .select("id, organization_id, branch_id, patient_id, philhealth_id, case_rate_code, status")
      .eq("id", claimId)
      .maybeSingle()

    if (claimError || !claim) {
      return new Response(JSON.stringify({ error: "Claim not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: allowed, error: permError } = await supabaseUser.rpc("has_permission", {
      p_permission: "billing.write",
      p_branch: claim.branch_id,
    })

    if (permError || !allowed) {
      return new Response(JSON.stringify({ error: "Permission denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (!["ready", "sync_failed"].includes(String(claim.status))) {
      return new Response(JSON.stringify({ error: "Claim must be ready or retry after sync failure" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (!claim.philhealth_id || !claim.case_rate_code) {
      return new Response(JSON.stringify({ error: "PhilHealth ID and case rate are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const result = await submitPhilHealthClaim({
      claim_id: claim.id,
      patient_id: claim.patient_id,
      philhealth_id: claim.philhealth_id,
      case_rate_code: claim.case_rate_code,
    })

    const syncStatus = result.ok ? "success" : "failed"
    const responseSummary = result.ok
      ? `${result.mode === "live" ? "Live" : "Dry-run"}: ${result.summary} (ref: ${result.providerRef})`
      : result.error

    const syncMode = result.ok ? result.mode : null

    const { data: logRow, error: logError } = await supabaseAdmin
      .from("philhealth_sync_logs")
      .insert({
        claim_id: claim.id,
        organization_id: claim.organization_id,
        status: syncStatus,
        response_summary: responseSummary,
        mode: syncMode,
      })
      .select("id")
      .single()

    if (logError) {
      return new Response(JSON.stringify({ error: logError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const nextClaimStatus = result.ok ? "submitted" : "sync_failed"
    const claimPatch: Record<string, unknown> = {
      status: nextClaimStatus,
      updated_at: new Date().toISOString(),
    }
    if (result.ok) {
      claimPatch.provider_ref = result.providerRef
      claimPatch.submitted_at = new Date().toISOString()
    }
    await supabaseAdmin.from("philhealth_claims").update(claimPatch).eq("id", claim.id)

    if (!result.ok) {
      return new Response(
        JSON.stringify({ error: result.error, sync_log_id: logRow.id, status: nextClaimStatus }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        sync_log_id: logRow.id,
        status: nextClaimStatus,
        mode: result.mode,
        provider_ref: result.providerRef,
        dry_run: result.mode === "dry_run",
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
