import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"
import { sendLiveSms } from "../_shared/sms-provider.ts"
import { resolveBranchNotificationTemplate } from "../_shared/notification-template.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
}

function renderBody(template: string, vars: Record<string, string>): string {
  let result = template
  for (const [key, val] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, val)
  }
  return result
}

function manilaTomorrowRange(): { start: string; end: string; label: string } {
  const now = new Date()
  const manilaNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }))
  const tomorrow = new Date(manilaNow)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const y = tomorrow.getFullYear()
  const m = String(tomorrow.getMonth() + 1).padStart(2, "0")
  const d = String(tomorrow.getDate()).padStart(2, "0")
  const label = `${y}-${m}-${d}`
  return {
    start: `${label}T00:00:00+08:00`,
    end: `${label}T23:59:59+08:00`,
    label,
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const cronSecret = Deno.env.get("CRON_SECRET")
    const headerSecret = req.headers.get("x-cron-secret")
    const authHeader = req.headers.get("Authorization") ?? ""
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!

    const authorized =
      (cronSecret && headerSecret === cronSecret) ||
      authHeader === `Bearer ${serviceRoleKey}`

    if (!authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
    const { start, end, label } = manilaTomorrowRange()

    const { data: appointments, error: queryError } = await supabaseAdmin
      .from("appointments")
      .select(
        "id, branch_id, organization_id, patient_id, scheduled_at, status, patients(first_name, last_name, phone), branches(name)"
      )
      .gte("scheduled_at", start)
      .lte("scheduled_at", end)
      .in("status", ["scheduled", "confirmed"])

    if (queryError) {
      return new Response(JSON.stringify({ error: queryError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    let sent = 0
    let skipped = 0
    const errors: string[] = []

    for (const appt of appointments ?? []) {
      const patient = Array.isArray(appt.patients) ? appt.patients[0] : appt.patients
      const branch = Array.isArray(appt.branches) ? appt.branches[0] : appt.branches
      const phone = String(patient?.phone ?? "").trim()

      if (!phone) {
        skipped += 1
        continue
      }

      const branchId = String(appt.branch_id ?? "")
      const template = branchId
        ? await resolveBranchNotificationTemplate(supabaseAdmin, branchId, "appointment_reminder")
        : null

      if (!template?.body) {
        skipped += 1
        errors.push(`${appt.id}: missing template`)
        continue
      }

      const scheduledAt = String(appt.scheduled_at)
      const date = new Date(scheduledAt).toLocaleDateString("en-PH", {
        timeZone: "Asia/Manila",
        weekday: "short",
        month: "short",
        day: "numeric",
      })
      const time = new Date(scheduledAt).toLocaleTimeString("en-PH", {
        timeZone: "Asia/Manila",
        hour: "2-digit",
        minute: "2-digit",
      })

      const messageBody = renderBody(template.body, {
        patient_name: [patient?.first_name, patient?.last_name].filter(Boolean).join(" ") || "Patient",
        clinic_name: String(branch?.name ?? "Clinic"),
        appointment_date: date,
        appointment_time: time,
      })

      const { data: branchSettings } = await supabaseAdmin
        .from("notification_branch_settings")
        .select("dry_run_mode")
        .eq("branch_id", appt.branch_id)
        .maybeSingle()

      const dryRun = branchSettings?.dry_run_mode ?? true
      let status = dryRun ? "dry_run" : "sent"
      let providerRef: string | null = null
      let errorMessage: string | null = null

      if (!dryRun) {
        const smsResult = await sendLiveSms(phone, messageBody)
        if (smsResult.ok) {
          providerRef = smsResult.providerRef
        } else {
          status = "failed"
          errorMessage = smsResult.error
        }
      }

      const { error: insertError } = await supabaseAdmin.from("notification_logs").insert({
        organization_id: appt.organization_id,
        branch_id: appt.branch_id,
        patient_id: appt.patient_id,
        template_id: template.id,
        template_key: "appointment_reminder",
        recipient_phone: phone,
        body_preview: `[cron ${label}] ${messageBody}`.slice(0, 500),
        status,
        provider_ref: providerRef,
        error_message: errorMessage,
        created_by: null,
      })

      if (insertError) {
        errors.push(`${appt.id}: ${insertError.message}`)
        skipped += 1
      } else {
        sent += 1
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: label,
        total: (appointments ?? []).length,
        sent,
        skipped,
        errors,
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
