import type { InvoiceDetail, InvoiceLineItem, InvoicePayment } from "@/lib/billing/invoice-service"

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function formatPhp(amount: number): string {
  return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  partial: "Partially paid",
  paid: "Paid",
  void: "Void",
}

export function buildInvoicePrintHtml(params: {
  invoice: InvoiceDetail
  payments: InvoicePayment[]
  lineItems?: InvoiceLineItem[]
  clinicName?: string
  clinicAddress?: string | null
  clinicPhone?: string | null
  branchName?: string | null
}): string {
  const {
    invoice,
    payments,
    lineItems = [],
    clinicName = "Dental Clinic",
    clinicAddress,
    clinicPhone,
    branchName,
  } = params
  const balance = invoice.total_amount - invoice.paid_amount
  const statusLabel = STATUS_LABELS[invoice.status] ?? invoice.status

  const lineRows = lineItems.length
    ? lineItems
        .map(
          (item) => `
        <tr>
          <td>${escapeHtml(item.description)}${item.tooth_number ? ` <span class="muted">(#${escapeHtml(item.tooth_number)})</span>` : ""}</td>
          <td class="num">${item.quantity}</td>
          <td class="num">${formatPhp(item.unit_price)}</td>
          <td class="num">${formatPhp(item.line_total)}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="4" class="muted">No line items</td></tr>`

  const paymentRows = payments.length
    ? payments
        .map(
          (p) => `
        <tr>
          <td>${formatDate(p.created_at)}</td>
          <td>${escapeHtml(p.payment_method)}</td>
          <td class="num">${formatPhp(p.amount)}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="3" class="muted">No payments recorded</td></tr>`

  const clinicMeta = [
    branchName ? escapeHtml(branchName) : null,
    clinicAddress ? escapeHtml(clinicAddress) : null,
    clinicPhone ? escapeHtml(clinicPhone) : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return `<!DOCTYPE html>
<html lang="en-PH">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(invoice.invoice_number ?? "Invoice")}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: "Segoe UI", system-ui, sans-serif; color: #0f172a; margin: 0; padding: 32px 40px; max-width: 780px; }
    .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; }
    .clinic { font-size: 1.375rem; font-weight: 700; letter-spacing: -0.02em; }
    .clinic-meta { font-size: 0.8125rem; color: #64748b; margin-top: 4px; max-width: 360px; line-height: 1.4; }
    .doc-title { text-align: right; }
    .doc-title h1 { font-size: 1.125rem; margin: 0; text-transform: uppercase; letter-spacing: 0.08em; color: #334155; }
    .doc-title p { margin: 4px 0 0; font-size: 0.875rem; color: #64748b; }
    .badge { display: inline-block; margin-top: 8px; padding: 2px 10px; border-radius: 999px; font-size: 0.75rem; font-weight: 600; background: #f1f5f9; color: #334155; }
    .badge.paid { background: #dcfce7; color: #166534; }
    .badge.partial { background: #fef3c7; color: #92400e; }
    .badge.void { background: #fee2e2; color: #991b1b; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; margin-bottom: 24px; font-size: 0.875rem; }
    .grid dt { color: #64748b; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 2px; }
    .grid dd { margin: 0; font-weight: 500; }
    h2 { font-size: 0.8125rem; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin: 28px 0 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 6px; text-align: left; vertical-align: top; }
    th { color: #64748b; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; }
    td.num, th.num { text-align: right; }
    .muted { color: #94a3b8; }
    .totals { margin-top: 20px; width: 300px; margin-left: auto; font-size: 0.875rem; }
    .totals div { display: flex; justify-content: space-between; padding: 6px 0; }
    .totals .balance { font-weight: 700; font-size: 1.125rem; border-top: 2px solid #0f172a; padding-top: 10px; margin-top: 4px; }
    .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 0.75rem; color: #94a3b8; line-height: 1.5; }
    @media print {
      body { padding: 20px 24px; }
      .no-print { display: none; }
    }
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      font-size: 3.5rem;
      color: rgba(220, 38, 38, 0.12);
      font-weight: 800;
      pointer-events: none;
      white-space: nowrap;
      z-index: 9999;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      border: 8px solid rgba(220, 38, 38, 0.12);
      padding: 8px 16px;
      border-radius: 12px;
      font-family: sans-serif;
    }
  </style>
</head>
<body>
  <div class="watermark">SAMPLE - NOT A VALID INVOICE</div>
  <div class="header">
    <div>
      <div class="clinic">${escapeHtml(clinicName)}</div>
      ${clinicMeta ? `<div class="clinic-meta">${clinicMeta}</div>` : ""}
    </div>
    <div class="doc-title">
      <h1>Invoice</h1>
      <p>${escapeHtml(invoice.invoice_number ?? invoice.id.slice(0, 8).toUpperCase())}</p>
      <p>${formatDate(invoice.created_at)}</p>
      <span class="badge ${escapeHtml(invoice.status)}">${escapeHtml(statusLabel)}</span>
    </div>
  </div>

  <dl class="grid">
    <div><dt>Patient</dt><dd>${escapeHtml(invoice.patient_name ?? "—")}</dd></div>
    <div><dt>Due date</dt><dd>${formatDate(invoice.due_date)}</dd></div>
  </dl>

  <h2>Line items</h2>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="num">Qty</th>
        <th class="num">Unit</th>
        <th class="num">Total</th>
      </tr>
    </thead>
    <tbody>${lineRows}</tbody>
  </table>

  <h2>Payments</h2>
  <table>
    <thead>
      <tr><th>Date</th><th>Method</th><th class="num">Amount</th></tr>
    </thead>
    <tbody>${paymentRows}</tbody>
  </table>

  <div class="totals">
    <div><span>Total billed</span><span>${formatPhp(invoice.total_amount)}</span></div>
    <div><span>Total paid</span><span>${formatPhp(invoice.paid_amount)}</span></div>
    <div class="balance"><span>Balance due</span><span>${formatPhp(balance)}</span></div>
  </div>

  <p class="footer">
    Generated ${new Date().toLocaleString("en-PH")} · Official receipt for clinic records.<br />
    Use <strong>Print → Save as PDF</strong> to download a copy.
  </p>
  
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>`
}

export function printInvoice(params: {
  invoice: InvoiceDetail
  payments: InvoicePayment[]
  lineItems?: InvoiceLineItem[]
  clinicName?: string
  clinicAddress?: string | null
  clinicPhone?: string | null
  branchName?: string | null
}): void {
  const html = buildInvoicePrintHtml(params)
  const base64Html = btoa(unescape(encodeURIComponent(html)))
  const dataUri = `data:text/html;charset=utf-8;base64,${base64Html}`
  window.open(dataUri, "_blank", "noopener,noreferrer,width=860,height=960")
}
