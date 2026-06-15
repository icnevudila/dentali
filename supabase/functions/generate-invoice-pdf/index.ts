import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"
import { buildInvoicePdf, pdfBytesToBase64 } from "../_shared/invoice-pdf.ts"

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
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

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
    const invoiceId = String(body.invoice_id ?? "").trim()

    if (!invoiceId) {
      return new Response(JSON.stringify({ error: "invoice_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: invoice, error: invoiceError } = await supabaseUser
      .from("invoices")
      .select(
        "id, invoice_number, total_amount, subtotal_amount, discount_amount, paid_amount, status, created_at, due_date, branch_id, organization_id, patients(first_name, last_name), branches(name), organizations(name)"
      )
      .eq("id", invoiceId)
      .single()

    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: allowed, error: permError } = await supabaseUser.rpc("has_permission", {
      p_permission: "billing.read",
      p_branch: invoice.branch_id,
    })

    if (permError || !allowed) {
      return new Response(JSON.stringify({ error: "Permission denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const [{ data: lineRows }, { data: paymentRows }] = await Promise.all([
      supabaseUser
        .from("invoice_line_items")
        .select("description, tooth_number, quantity, unit_price, line_total, discount_amount, sort_order")
        .eq("invoice_id", invoiceId)
        .order("sort_order"),
      supabaseUser
        .from("invoice_payments")
        .select("amount, payment_method, created_at")
        .eq("invoice_id", invoiceId)
        .order("created_at", { ascending: false }),
    ])

    const patient = invoice.patients as
      | { first_name: string; last_name: string }
      | { first_name: string; last_name: string }[]
      | null
    const patientRow = Array.isArray(patient) ? patient[0] : patient
    const branch = invoice.branches as { name: string } | { name: string }[] | null
    const branchRow = Array.isArray(branch) ? branch[0] : branch
    const org = invoice.organizations as { name: string } | { name: string }[] | null
    const orgRow = Array.isArray(org) ? org[0] : org

    const pdfBytes = await buildInvoicePdf({
      clinicName: orgRow?.name ?? "Dental Clinic",
      branchName: branchRow?.name ?? null,
      invoiceNumber: invoice.invoice_number,
      invoiceId: invoice.id,
      status: invoice.status,
      createdAt: invoice.created_at,
      dueDate: invoice.due_date,
      patientName: patientRow ? `${patientRow.first_name} ${patientRow.last_name}` : null,
      subtotalAmount: invoice.subtotal_amount != null ? Number(invoice.subtotal_amount) : null,
      discountAmount: invoice.discount_amount != null ? Number(invoice.discount_amount) : null,
      totalAmount: Number(invoice.total_amount),
      paidAmount: Number(invoice.paid_amount),
      lineItems: (lineRows ?? []).map((row) => ({
        description: row.description,
        tooth_number: row.tooth_number,
        quantity: Number(row.quantity),
        unit_price: Number(row.unit_price),
        line_total: Number(row.line_total),
        discount_amount: row.discount_amount != null ? Number(row.discount_amount) : 0,
      })),
      payments: (paymentRows ?? []).map((row) => ({
        created_at: row.created_at,
        payment_method: row.payment_method,
        amount: Number(row.amount),
      })),
    })

    const filenameBase = invoice.invoice_number ?? `invoice-${invoice.id.slice(0, 8)}`

    return new Response(
      JSON.stringify({
        data: {
          invoice_id: invoice.id,
          format: "application/pdf",
          filename: `${filenameBase}.pdf`,
          pdf_base64: pdfBytesToBase64(pdfBytes),
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error("generate-invoice-pdf error", err)
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
