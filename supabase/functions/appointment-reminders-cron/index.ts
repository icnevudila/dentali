import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"
import { sendLiveSms } from "../_shared/sms-provider.ts"
import { resolveBranchNotificationTemplate } from "../_shared/notification-template.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
}

type ReminderType = "24h" | "2h" | "no_show"

function renderBody(template: string, vars: Record<string, string>): string {
  let result = template
  for (const [key, val] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, val)
  }
  return result
}

function windowForType(type: ReminderType): { start: string; end: string } {
  const now = Date.now()
  if (type === "24h") {
    return {
      start: new Date(now + 23 * 60 * 60 * 1000).toISOString(),
      end: new Date(now + 25 * 60 * 60 * 1000).toISOString(),
    }
  }
  if (type === "2h") {
    return {
      start: new Date(now + 90 * 60 * 1000).toISOString(),
      end: new Date(now + 150 * 60 * 1000).toISOString(),
    }
  }
  const manila = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }))
  const y = manila.getFullYear()
  const m = String(manila.getMonth() + 1).padStart(2, "0")
  const d = String(manila.getDate()).padStart(2, "0")
  const label = `${y}-${m}-${d}`
  return {
    start: `${label}T00:00:00+08:00`,
    end: `${label}T23:59:59+08:00`,
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
    const summary: Record<string, { sent: number; skipped: number }> = {}

    for (const reminderType of ["24h", "2h", "no_show"] as ReminderType[]) {
      const { start, end } = windowForType(reminderType)
      let sent = 0
      let skipped = 0

      let query = supabaseAdmin
        .from("appointments")
        .select(
          "id, branch_id, organization_id, patient_id, scheduled_at, status, patients(first_name, last_name, phone), branches(name)"
        )

      if (reminderType === "no_show") {
        query = query.gte("scheduled_at", start).lte("scheduled_at", end).eq("status", "no_show")
      } else {
        query = query
          .gte("scheduled_at", start)
          .lte("scheduled_at", end)
          .in("status", ["scheduled", "confirmed"])
      }

      const { data: appointments, error: queryError } = await query

      if (queryError) {
        summary[reminderType] = { sent: 0, skipped: 0 }
        continue
      }

      for (const appt of appointments ?? []) {
        const { data: existing } = await supabaseAdmin
          .from("appointment_reminder_dispatches")
          .select("id")
          .eq("appointment_id", appt.id)
          .eq("reminder_type", reminderType)
          .maybeSingle()

        if (existing) {
          skipped += 1
          continue
        }

        const { data: wfRow } = await supabaseAdmin
          .from("branch_workflow_settings")
          .select("settings")
          .eq("branch_id", appt.branch_id)
          .maybeSingle()

        const autoSms = (wfRow?.settings as Record<string, boolean> | null)?.auto_sms_reminders ?? true
        if (!autoSms) {
          skipped += 1
          continue
        }

        const patient = Array.isArray(appt.patients) ? appt.patients[0] : appt.patients
        const branch = Array.isArray(appt.branches) ? appt.branches[0] : appt.branches
        const phone = String(patient?.phone ?? "").trim()

        if (!phone) {
          skipped += 1
          continue
        }

        const templateKey = "appointment_reminder"
        const template = await resolveBranchNotificationTemplate(
          supabaseAdmin,
          String(appt.branch_id),
          templateKey
        )

        if (!template?.body) {
          skipped += 1
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
          if (smsResult.ok) providerRef = smsResult.providerRef
          else {
            status = "failed"
            errorMessage = smsResult.error
          }
        }

        const { data: logRow } = await supabaseAdmin
          .from("notification_logs")
          .insert({
            organization_id: appt.organization_id,
            branch_id: appt.branch_id,
            patient_id: appt.patient_id,
            template_id: template.id,
            template_key: templateKey,
            recipient_phone: phone,
            body_preview: `[${reminderType}] ${messageBody}`.slice(0, 500),
            status,
            provider_ref: providerRef,
            error_message: errorMessage,
            created_by: null,
          })
          .select("id")
          .single()

        if (status !== "failed") {
          await supabaseAdmin.from("appointment_reminder_dispatches").insert({
            organization_id: appt.organization_id,
            branch_id: appt.branch_id,
            appointment_id: appt.id,
            reminder_type: reminderType,
            notification_log_id: logRow?.id ?? null,
          })
          sent += 1
        } else {
          skipped += 1
        }
      }

      summary[reminderType] = { sent, skipped }
    }

    return new Response(JSON.stringify({ success: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
