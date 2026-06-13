import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
}

type CloseoutPayload = {
  date?: string
  collected?: number
  open_balance?: number
  open_invoice_count?: number
  appointments_completed?: number
  no_show?: number
  pending_consents?: number
  hmo_pending?: number
  low_stock?: number
}

function formatCurrency(amount: number): string {
  return `₱${Number(amount ?? 0).toLocaleString("en-PH")}`
}

function buildCloseoutHtml(date: string, payload: CloseoutPayload): string {
  const rows = [
    ["Collected", formatCurrency(Number(payload.collected ?? 0))],
    ["Open balance", formatCurrency(Number(payload.open_balance ?? 0))],
    ["Open invoices", String(payload.open_invoice_count ?? 0)],
    ["Appointments completed", String(payload.appointments_completed ?? 0)],
    ["No-shows", String(payload.no_show ?? 0)],
    ["Pending consents", String(payload.pending_consents ?? 0)],
    ["HMO pending", formatCurrency(Number(payload.hmo_pending ?? 0))],
    ["Low stock items", String(payload.low_stock ?? 0)],
  ]

  const body = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666">${label}</td>` +
        `<td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;text-align:right">${value}</td></tr>`
    )
    .join("")

  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;color:#111">
    <h2 style="margin:0 0 8px">Daily closeout — ${date}</h2>
    <p style="margin:0 0 16px;color:#666">Automated end-of-day summary from Dentali.</p>
    <table style="border-collapse:collapse;width:100%;max-width:420px">${body}</table>
  </body></html>`
}

async function sendViaResend(
  to: string,
  subject: string,
  html: string
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY")
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not configured" }

  const from = Deno.env.get("CLOSEOUT_EMAIL_FROM") ?? "Dentali Closeout <closeout@dentali.ph>"
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  })

  if (!res.ok) {
    const text = await res.text()
    return { ok: false, error: text.slice(0, 500) }
  }
  return { ok: true }
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
    const dryRun =
      Deno.env.get("CLOSEOUT_EMAIL_DRY_RUN") === "true" || !Deno.env.get("RESEND_API_KEY")

    const { data: enqueued, error: enqueueError } = await supabaseAdmin.rpc(
      "enqueue_closeout_email_digest"
    )

    if (enqueueError) {
      return new Response(JSON.stringify({ error: enqueueError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: batch, error: batchError } = await supabaseAdmin.rpc("claim_closeout_email_batch", {
      p_limit: 20,
    })

    if (batchError) {
      return new Response(JSON.stringify({ error: batchError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const rows = (batch ?? []) as {
      id: string
      recipient_email: string
      snapshot_date: string
      payload: CloseoutPayload
    }[]

    let sent = 0
    let skipped = 0

    for (const row of rows) {
      const date = String(row.snapshot_date)
      const subject = `Daily closeout — ${date}`
      const html = buildCloseoutHtml(date, row.payload ?? {})

      if (dryRun) {
        await supabaseAdmin.rpc("mark_closeout_email_sent", {
          p_id: row.id,
          p_status: "dry_run",
          p_error: null,
        })
        sent += 1
        continue
      }

      const result = await sendViaResend(row.recipient_email, subject, html)
      if (result.ok) {
        await supabaseAdmin.rpc("mark_closeout_email_sent", {
          p_id: row.id,
          p_status: "sent",
          p_error: null,
        })
        sent += 1
      } else {
        await supabaseAdmin.rpc("mark_closeout_email_sent", {
          p_id: row.id,
          p_status: "failed",
          p_error: result.error ?? "Send failed",
        })
        skipped += 1
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: dryRun,
        enqueued: Number(enqueued ?? 0),
        processed: rows.length,
        sent,
        failed: skipped,
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
