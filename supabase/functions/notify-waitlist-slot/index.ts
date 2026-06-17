import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"
import { sendOrgLiveSms } from "../_shared/provider-secrets.ts"
import { resolveBranchNotificationTemplate } from "../_shared/notification-template.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function renderBody(template: string, vars: Record<string, string>): string {
  let result = template
  for (const [key, val] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, val)
  }
  return result
}

function formatManilaSlot(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString("en-PH", {
      timeZone: "Asia/Manila",
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
    time: d.toLocaleTimeString("en-PH", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      minute: "2-digit",
    }),
  }
}

interface WaitlistCandidate {
  entry_id: string
  patient_id: string
  patient_name: string
  patient_phone: string | null
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
    const branchId = String(body.branch_id ?? "").trim()
    const slotAt = String(body.slot_at ?? "").trim()
    const limit = Math.min(Math.max(Number(body.limit ?? 3) || 3, 1), 10)

    if (!branchId || !slotAt) {
      return new Response(JSON.stringify({ error: "branch_id and slot_at are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: canAppt } = await supabaseUser.rpc("has_permission", {
      p_permission: "appointments.write",
      p_branch: branchId,
    })
    const { data: canNotify } = await supabaseUser.rpc("has_permission", {
      p_permission: "notifications.write",
      p_branch: branchId,
    })

    if (!canAppt && !canNotify) {
      return new Response(JSON.stringify({ error: "Permission denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: branch } = await supabaseAdmin
      .from("branches")
      .select("id, name, organization_id")
      .eq("id", branchId)
      .maybeSingle()

    if (!branch) {
      return new Response(JSON.stringify({ error: "Branch not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: candidates, error: candError } = await supabaseUser.rpc(
      "get_waitlist_notify_candidates",
      { p_branch_id: branchId, p_slot_at: slotAt, p_limit: limit }
    )

    if (candError) {
      return new Response(JSON.stringify({ error: candError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const list = (candidates ?? []) as WaitlistCandidate[]
    if (list.length === 0) {
      return new Response(
        JSON.stringify({ success: true, notified: 0, skipped: 0, results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const template = await resolveBranchNotificationTemplate(
      supabaseAdmin,
      branchId,
      "waitlist_slot"
    )

    if (!template?.body) {
      return new Response(JSON.stringify({ error: "waitlist_slot template not found" }), {
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
    const slotLabel = formatManilaSlot(slotAt)
    const results: Array<{
      entry_id: string
      patient_id: string
      status: string
      log_id?: string
      error?: string
    }> = []

    let notified = 0
    let skipped = 0

    for (const candidate of list) {
      const phone = String(candidate.patient_phone ?? "").trim()
      if (!phone) {
        skipped += 1
        results.push({
          entry_id: candidate.entry_id,
          patient_id: candidate.patient_id,
          status: "skipped",
          error: "No phone on file",
        })
        continue
      }

      const messageBody = renderBody(template.body, {
        patient_name: candidate.patient_name || "Patient",
        clinic_name: String(branch.name ?? "Clinic"),
        slot_date: slotLabel.date,
        slot_time: slotLabel.time,
      })

      let status = dryRun ? "dry_run" : "sent"
      let providerRef: string | null = null
      let errorMessage: string | null = null

      if (!dryRun) {
        const smsResult = await sendOrgLiveSms(supabaseAdmin, {
          organizationId: String(branch.organization_id),
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
          organization_id: branch.organization_id,
          branch_id: branchId,
          patient_id: candidate.patient_id,
          template_id: template.id,
          template_key: "waitlist_slot",
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
        skipped += 1
        results.push({
          entry_id: candidate.entry_id,
          patient_id: candidate.patient_id,
          status: "failed",
          error: insertError.message,
        })
        continue
      }

      if (status === "failed") {
        skipped += 1
        results.push({
          entry_id: candidate.entry_id,
          patient_id: candidate.patient_id,
          status: "failed",
          log_id: logRow.id,
          error: errorMessage ?? "SMS failed",
        })
        continue
      }

      await supabaseUser.rpc("record_waitlist_slot_notify", {
        p_entry_id: candidate.entry_id,
        p_slot_at: slotAt,
        p_notification_log_id: logRow.id,
      })

      notified += 1
      results.push({
        entry_id: candidate.entry_id,
        patient_id: candidate.patient_id,
        status,
        log_id: logRow.id,
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        notified,
        skipped,
        dry_run: dryRun,
        results,
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
