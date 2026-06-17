import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"
import {
  cronCorsHeaders,
  cronErrorResponse,
  cronJsonResponse,
  cronUnauthorizedResponse,
  isCronAuthorized,
} from "../_shared/cron-auth.ts"
import { resolveBranchNotificationTemplate } from "../_shared/notification-template.ts"
import { formatPhpCurrency, renderNotificationBody } from "../_shared/render-template.ts"
import {
  branchDryRunMode,
  dispatchBranchSms,
  logSmsDispatch,
} from "../_shared/sms-dispatch.ts"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cronCorsHeaders })
  }

  try {
    if (!isCronAuthorized(req)) {
      return cronUnauthorizedResponse()
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const { data: branches } = await supabaseAdmin
      .from("branches")
      .select("id")
      .eq("is_active", true)

    let enqueued = 0
    for (const branch of branches ?? []) {
      const { data: count } = await supabaseAdmin.rpc("enqueue_payment_reminders", {
        p_branch_id: branch.id,
      })
      enqueued += Number(count ?? 0)
    }

    const { data: batch, error: batchError } = await supabaseAdmin.rpc("claim_payment_reminder_batch", {
      p_limit: 30,
    })

    if (batchError) {
      return cronErrorResponse(batchError.message, 400)
    }

    const rows = (batch ?? []) as {
      id: string
      branch_id: string
      organization_id: string
      patient_id: string
      balance_amount: number
    }[]

    let sent = 0
    let skipped = 0

    for (const row of rows) {
      const { data: patient } = await supabaseAdmin
        .from("patients")
        .select("first_name, last_name, phone")
        .eq("id", row.patient_id)
        .maybeSingle()

      const phone = String(patient?.phone ?? "").trim()
      if (!phone) {
        await supabaseAdmin.rpc("mark_payment_reminder_processed", { p_id: row.id })
        skipped += 1
        continue
      }

      const template = await resolveBranchNotificationTemplate(
        supabaseAdmin,
        row.branch_id,
        "payment_reminder"
      )

      if (!template?.body) {
        await supabaseAdmin.rpc("mark_payment_reminder_processed", { p_id: row.id })
        skipped += 1
        continue
      }

      const { data: branch } = await supabaseAdmin
        .from("branches")
        .select("name")
        .eq("id", row.branch_id)
        .maybeSingle()

      const messageBody = renderNotificationBody(template.body, {
        patient_name: [patient?.first_name, patient?.last_name].filter(Boolean).join(" ") || "Patient",
        clinic_name: String(branch?.name ?? "Clinic"),
        amount: formatPhpCurrency(Number(row.balance_amount)),
      })

      const dryRun = await branchDryRunMode(supabaseAdmin, row.branch_id)
      const status = await dispatchBranchSms({
        supabaseAdmin,
        organizationId: row.organization_id,
        branchId: row.branch_id,
        phone,
        messageBody,
        dryRun,
      })

      await logSmsDispatch({
        supabaseAdmin,
        organizationId: row.organization_id,
        branchId: row.branch_id,
        patientId: row.patient_id,
        templateId: template.id,
        templateKey: "payment_reminder",
        phone,
        body: messageBody,
        status,
      })

      await supabaseAdmin.rpc("mark_payment_reminder_processed", { p_id: row.id })
      if (status === "failed") skipped += 1
      else sent += 1
    }

    return cronJsonResponse({ success: true, enqueued, processed: rows.length, sent, skipped })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return cronErrorResponse(message)
  }
})
