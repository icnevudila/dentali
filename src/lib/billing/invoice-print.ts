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
  partial: "Partially Paid",
  paid: "Paid",
  void: "Void",
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: "#f1f5f9", text: "#475569" },
  sent: { bg: "#dbeafe", text: "#1e40af" },
  partial: { bg: "#fef3c7", text: "#92400e" },
  paid: { bg: "#dcfce7", text: "#166534" },
  void: { bg: "#fee2e2", text: "#991b1b" },
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
  const statusColor = STATUS_COLORS[invoice.status] ?? STATUS_COLORS.sent

  const lineRows = lineItems.length
    ? lineItems
        .map(
          (item, i) => `
        <tr class="${i % 2 === 1 ? 'alt' : ''}">
          <td class="desc">${escapeHtml(item.description)}${item.tooth_number ? ` <span class="tooth">#${escapeHtml(item.tooth_number)}</span>` : ""}</td>
          <td class="num">${item.quantity}</td>
          <td class="num">${formatPhp(item.unit_price)}</td>
          <td class="num bold">${formatPhp(item.line_total)}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="4" class="empty">No line items</td></tr>`

  const paymentRows = payments.length
    ? payments
        .map(
          (p, i) => `
        <tr class="${i % 2 === 1 ? 'alt' : ''}">
          <td>${formatDate(p.created_at)}</td>
          <td><span class="method-badge">${escapeHtml(p.payment_method.toUpperCase())}</span></td>
          <td class="num bold">${formatPhp(p.amount)}</td>
          <td class="muted">${p.notes ? escapeHtml(p.notes) : '—'}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="4" class="empty">No payments recorded yet</td></tr>`

  const contactParts = [
    branchName ? escapeHtml(branchName) : null,
    clinicAddress ? escapeHtml(clinicAddress) : null,
    clinicPhone ? escapeHtml(clinicPhone) : null,
  ].filter(Boolean)

  const invoiceNo = invoice.invoice_number ?? invoice.id.slice(0, 8).toUpperCase()
  const isPaid = invoice.status === "paid" || balance <= 0
  const isVoid = invoice.status === "void"

  return `<!DOCTYPE html>
<html lang="en-PH">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(invoiceNo)} — ${escapeHtml(clinicName)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

    :root {
      --primary: #0f172a;
      --primary-light: #334155;
      --muted: #94a3b8;
      --border: #e2e8f0;
      --bg-alt: #f8fafc;
      --accent: #2563eb;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', -apple-system, 'Segoe UI', system-ui, sans-serif;
      color: var(--primary);
      background: #fff;
      padding: 48px 56px;
      max-width: 820px;
      margin: 0 auto;
      font-size: 13px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }

    /* ─── Header ─── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 32px;
      margin-bottom: 40px;
    }
    .brand {
      flex: 1;
    }
    .brand h1 {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: var(--primary);
      margin-bottom: 4px;
    }
    .brand-meta {
      font-size: 12px;
      color: var(--muted);
      line-height: 1.6;
    }
    .invoice-meta {
      text-align: right;
      min-width: 200px;
    }
    .invoice-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--muted);
      margin-bottom: 6px;
    }
    .invoice-number {
      font-size: 18px;
      font-weight: 700;
      color: var(--primary);
      letter-spacing: -0.01em;
    }
    .invoice-date {
      font-size: 12px;
      color: var(--primary-light);
      margin-top: 4px;
    }
    .status-badge {
      display: inline-block;
      margin-top: 10px;
      padding: 3px 14px;
      border-radius: 100px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      background: ${statusColor.bg};
      color: ${statusColor.text};
    }

    /* ─── Divider ─── */
    .divider {
      height: 2px;
      background: linear-gradient(90deg, var(--primary) 40%, transparent 100%);
      margin-bottom: 32px;
    }

    /* ─── Info Grid ─── */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 36px;
    }
    .info-block label {
      display: block;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--muted);
      margin-bottom: 4px;
    }
    .info-block span {
      font-size: 14px;
      font-weight: 600;
      color: var(--primary);
    }

    /* ─── Section Header ─── */
    .section-header {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--muted);
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 1px solid var(--border);
    }

    /* ─── Tables ─── */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 32px;
    }
    th {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
      padding: 8px 10px;
      text-align: left;
      border-bottom: 2px solid var(--border);
    }
    td {
      padding: 10px 10px;
      font-size: 13px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: top;
    }
    tr.alt td {
      background: var(--bg-alt);
    }
    td.num, th.num { text-align: right; }
    td.bold { font-weight: 600; }
    td.desc { max-width: 280px; }
    td.empty {
      color: var(--muted);
      font-style: italic;
      padding: 16px 10px;
    }
    .tooth {
      color: var(--accent);
      font-weight: 500;
      font-size: 11px;
    }
    .method-badge {
      display: inline-block;
      padding: 2px 8px;
      background: #f1f5f9;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      color: var(--primary-light);
    }

    /* ─── Totals ─── */
    .totals-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 40px;
    }
    .totals {
      width: 280px;
    }
    .totals .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 0;
      font-size: 13px;
    }
    .totals .row .label { color: var(--primary-light); }
    .totals .row .value { font-weight: 600; text-align: right; }
    .totals .row.grand {
      border-top: 2px solid var(--primary);
      margin-top: 8px;
      padding-top: 12px;
    }
    .totals .row.grand .label {
      font-size: 14px;
      font-weight: 700;
      color: var(--primary);
    }
    .totals .row.grand .value {
      font-size: 20px;
      font-weight: 800;
      color: ${isPaid ? '#166534' : isVoid ? '#991b1b' : 'var(--primary)'};
    }

    /* ─── Footer ─── */
    .footer {
      margin-top: 48px;
      padding-top: 20px;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 24px;
    }
    .footer-left {
      font-size: 11px;
      color: var(--muted);
      line-height: 1.6;
    }
    .footer-right {
      text-align: right;
      font-size: 10px;
      color: var(--muted);
    }

    /* ─── Print Button (hidden on print) ─── */
    .toolbar {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
    }
    .toolbar button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 24px;
      background: var(--primary);
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s;
    }
    .toolbar button:hover { background: #1e293b; }
    .toolbar button.outline {
      background: #fff;
      color: var(--primary);
      border: 1px solid var(--border);
    }
    .toolbar button.outline:hover { background: var(--bg-alt); }

    @media print {
      body { padding: 24px 28px; }
      .no-print { display: none !important; }
      .totals .row.grand .value { color: var(--primary) !important; }
    }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <button onclick="window.print()">🖨️ Print / Save as PDF</button>
    <button class="outline" onclick="window.close()">✕ Close</button>
  </div>

  <div class="header">
    <div class="brand">
      <h1>${escapeHtml(clinicName)}</h1>
      ${contactParts.length > 0 ? `<div class="brand-meta">${contactParts.join('<br />')}</div>` : ''}
    </div>
    <div class="invoice-meta">
      <div class="invoice-title">Invoice</div>
      <div class="invoice-number">${escapeHtml(invoiceNo)}</div>
      <div class="invoice-date">${formatDate(invoice.created_at)}</div>
      <span class="status-badge">${escapeHtml(statusLabel)}</span>
    </div>
  </div>

  <div class="divider"></div>

  <div class="info-grid">
    <div class="info-block">
      <label>Bill To</label>
      <span>${escapeHtml(invoice.patient_name ?? "—")}</span>
    </div>
    <div class="info-block">
      <label>Due Date</label>
      <span>${formatDate(invoice.due_date)}</span>
    </div>
  </div>

  <div class="section-header">Line Items</div>
  <table>
    <thead>
      <tr>
        <th style="width:45%">Description</th>
        <th class="num" style="width:10%">Qty</th>
        <th class="num" style="width:22%">Unit Price</th>
        <th class="num" style="width:23%">Amount</th>
      </tr>
    </thead>
    <tbody>${lineRows}</tbody>
  </table>

  ${payments.length > 0 || invoice.paid_amount > 0 ? `
  <div class="section-header">Payment History</div>
  <table>
    <thead>
      <tr>
        <th style="width:25%">Date</th>
        <th style="width:20%">Method</th>
        <th class="num" style="width:25%">Amount</th>
        <th style="width:30%">Notes</th>
      </tr>
    </thead>
    <tbody>${paymentRows}</tbody>
  </table>
  ` : ''}

  <div class="totals-section">
    <div class="totals">
      <div class="row">
        <span class="label">Subtotal</span>
        <span class="value">${formatPhp(invoice.total_amount)}</span>
      </div>
      <div class="row">
        <span class="label">Total Paid</span>
        <span class="value">${formatPhp(invoice.paid_amount)}</span>
      </div>
      <div class="row grand">
        <span class="label">${isPaid ? 'Fully Paid' : isVoid ? 'Voided' : 'Balance Due'}</span>
        <span class="value">${isPaid ? '✓ ₱0.00' : formatPhp(balance)}</span>
      </div>
    </div>
  </div>

  <div class="footer">
    <div class="footer-left">
      ${escapeHtml(clinicName)}<br />
      Thank you for your visit.
    </div>
    <div class="footer-right">
      Document generated on ${formatDate(new Date().toISOString())}<br />
      Reference: ${escapeHtml(invoiceNo)}
    </div>
  </div>
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
  // Use Blob URL — data: URIs are blocked by modern browsers
  const blob = new Blob([html], { type: "text/html;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, "_blank")
  if (!win) {
    // Fallback: inject iframe
    const iframe = document.createElement("iframe")
    iframe.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99999;border:none;background:#fff"
    iframe.src = url
    document.body.appendChild(iframe)
    const closeBtn = document.createElement("button")
    closeBtn.textContent = "✕ Close"
    closeBtn.style.cssText = "position:fixed;top:12px;right:12px;z-index:100000;padding:8px 16px;background:#0f172a;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600"
    closeBtn.onclick = () => {
      document.body.removeChild(iframe)
      document.body.removeChild(closeBtn)
      URL.revokeObjectURL(url)
    }
    document.body.appendChild(closeBtn)
    return
  }
  win.addEventListener("load", () => {
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  })
}
