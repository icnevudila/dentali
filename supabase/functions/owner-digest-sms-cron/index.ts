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
  closeoutVarsFromPayload,
  renderNotificationBody,
  type CloseoutPayload,
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

    const { data: enqueued, error: enqueueError } = await supabaseAdmin.rpc(
      "enqueue_owner_digest_sms"
    )

    if (enqueueError) {
      return cronErrorResponse(enqueueError.message, 400)
    }

    const { data: batch, error: batchError } = await supabaseAdmin.rpc(
      "claim_owner_digest_sms_batch",
      { p_limit: 20 }
    )

    if (batchError) {
      return cronErrorResponse(batchError.message, 400)
    }

    const rows = (batch ?? []) as {
      id: string
      organization_id: string
      branch_id: string
      recipient_phone: string
      snapshot_date: string
      payload: CloseoutPayload
    }[]

    let sent = 0
    let skipped = 0

    for (const row of rows) {
      const phone = String(row.recipient_phone ?? "").trim()
      if (!phone) {
        await supabaseAdmin.rpc("mark_owner_digest_sms_sent", {
          p_id: row.id,
          p_status: "skipped",
          p_error: "No phone",
        })
        skipped += 1
        continue
      }

      const template = await resolveBranchNotificationTemplate(
        supabaseAdmin,
        row.branch_id,
        "owner_daily_digest"
      )

      if (!template?.body) {
        await supabaseAdmin.rpc("mark_owner_digest_sms_sent", {
          p_id: row.id,
          p_status: "skipped",
          p_error: "Template missing",
        })
        skipped += 1
        continue
      }

      const { data: branch } = await supabaseAdmin
        .from("branches")
        .select("name")
        .eq("id", row.branch_id)
        .maybeSingle()

      const vars = closeoutVarsFromPayload(
        String(branch?.name ?? "Clinic"),
        row.payload ?? { date: row.snapshot_date }
      )

      const messageBody = renderNotificationBody(template.body, vars)
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
        templateId: template.id,
        templateKey: "owner_daily_digest",
        phone,
        body: messageBody,
        status,
      })

      await supabaseAdmin.rpc("mark_owner_digest_sms_sent", {
        p_id: row.id,
        p_status: status,
        p_error: status === "failed" ? "SMS send failed" : null,
      })

      if (status === "failed") skipped += 1
      else sent += 1
    }

    return cronJsonResponse({
      success: true,
      enqueued: Number(enqueued ?? 0),
      processed: rows.length,
      sent,
      skipped,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return cronErrorResponse(message)
  }
})
