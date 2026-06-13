import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"
import {
  cronCorsHeaders,
  cronErrorResponse,
  cronJsonResponse,
  isCronAuthorized,
  cronUnauthorizedResponse,
} from "../_shared/cron-auth.ts"
import { resolveBranchNotificationTemplate } from "../_shared/notification-template.ts"
import {
  renderNotificationBody,
  resolveSiteUrl,
} from "../_shared/render-template.ts"
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
      const { data: count } = await supabaseAdmin.rpc("enqueue_hygiene_recalls", {
        p_branch_id: branch.id,
        p_months: 6,
      })
      enqueued += Number(count ?? 0)
    }

    const { data: batch, error: batchError } = await supabaseAdmin.rpc(
      "claim_hygiene_recall_batch",
      { p_limit: 30 }
    )

    if (batchError) {
      return cronErrorResponse(batchError.message, 400)
    }

    const rows = (batch ?? []) as {
      id: string
      branch_id: string
      organization_id: string
      patient_id: string
      last_visit_date: string
    }[]

    const siteUrl = resolveSiteUrl()
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
        await supabaseAdmin.rpc("mark_hygiene_recall_processed", {
          p_id: row.id,
          p_dispatched: false,
        })
        skipped += 1
        continue
      }

      const template = await resolveBranchNotificationTemplate(
        supabaseAdmin,
        row.branch_id,
        "hygiene_recall"
      )

      if (!template?.body) {
        await supabaseAdmin.rpc("mark_hygiene_recall_processed", {
          p_id: row.id,
          p_dispatched: false,
        })
        skipped += 1
        continue
      }

      const { data: branch } = await supabaseAdmin
        .from("branches")
        .select("name")
        .eq("id", row.branch_id)
        .maybeSingle()

      const messageBody = renderNotificationBody(template.body, {
        patient_name:
          [patient?.first_name, patient?.last_name].filter(Boolean).join(" ") || "Patient",
        clinic_name: String(branch?.name ?? "Clinic"),
        booking_link: `${siteUrl}/welcome?utm=recall`,
        last_visit_date: String(row.last_visit_date ?? ""),
      })

      const dryRun = await branchDryRunMode(supabaseAdmin, row.branch_id)
      const status = await dispatchBranchSms({
        supabaseAdmin,
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
        templateKey: "hygiene_recall",
        phone,
        body: messageBody,
        status,
      })

      await supabaseAdmin.rpc("mark_hygiene_recall_processed", {
        p_id: row.id,
        p_dispatched: status !== "failed",
      })

      if (status === "failed") skipped += 1
      else sent += 1
    }

    return cronJsonResponse({
      success: true,
      enqueued,
      processed: rows.length,
      sent,
      skipped,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return cronErrorResponse(message)
  }
})
