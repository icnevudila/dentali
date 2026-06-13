import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1"

export type InvoicePdfLineItem = {
  description: string
  tooth_number: string | null
  quantity: number
  unit_price: number
  line_total: number
}

export type InvoicePdfPayment = {
  created_at: string
  payment_method: string
  amount: number
}

function formatPhp(amount: number): string {
  return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  })
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  partial: "Partially paid",
  paid: "Paid",
  void: "Void",
}

export async function buildInvoicePdf(params: {
  clinicName: string
  branchName?: string | null
  invoiceNumber: string | null
  invoiceId: string
  status: string
  createdAt: string
  dueDate: string | null
  patientName: string | null
  totalAmount: number
  paidAmount: number
  lineItems: InvoicePdfLineItem[]
  payments: InvoicePdfPayment[]
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  let page = doc.addPage([612, 792])
  let y = 750
  const left = 50
  const right = 562
  const maxWidth = right - left

  const ensureSpace = (needed: number) => {
    if (y - needed < 60) {
      page = doc.addPage([612, 792])
      y = 750
    }
  }

  const draw = (text: string, size = 11, isBold = false, indent = 0) => {
    const drawFont = isBold ? bold : font
    let remaining = text
    while (remaining.length > 0) {
      ensureSpace(size + 8)
      let splitAt = remaining.length
      while (
        splitAt > 0 &&
        drawFont.widthOfTextAtSize(remaining.slice(0, splitAt), size) > maxWidth - indent
      ) {
        splitAt -= 1
      }
      if (splitAt === 0) splitAt = 1
      page.drawText(remaining.slice(0, splitAt), {
        x: left + indent,
        y,
        size,
        font: drawFont,
        color: rgb(0.12, 0.12, 0.12),
      })
      y -= size + 6
      remaining = remaining.slice(splitAt).trimStart()
    }
  }

  const balance = params.totalAmount - params.paidAmount
  const statusLabel = STATUS_LABELS[params.status] ?? params.status
  const docNumber = params.invoiceNumber ?? params.invoiceId.slice(0, 8).toUpperCase()

  draw(params.clinicName, 16, true)
  if (params.branchName) draw(params.branchName, 10)
  y -= 8
  draw("INVOICE", 14, true)
  draw(`No. ${docNumber}`)
  draw(`Date: ${formatDate(params.createdAt)}`)
  draw(`Status: ${statusLabel}`)
  y -= 6
  draw(`Patient: ${params.patientName ?? "—"}`)
  draw(`Due date: ${formatDate(params.dueDate)}`)
  y -= 10
  draw("Line items", 12, true)

  if (params.lineItems.length === 0) {
    draw("No line items", 10)
  } else {
    for (const item of params.lineItems) {
      const tooth = item.tooth_number ? ` (#${item.tooth_number})` : ""
      draw(`${item.description}${tooth}`, 10)
      draw(
        `  Qty ${item.quantity} × ${formatPhp(item.unit_price)} = ${formatPhp(item.line_total)}`,
        9,
        false,
        8
      )
    }
  }

  y -= 8
  draw("Payments", 12, true)
  if (params.payments.length === 0) {
    draw("No payments recorded", 10)
  } else {
    for (const payment of params.payments) {
      draw(
        `${formatDate(payment.created_at)} · ${payment.payment_method} · ${formatPhp(payment.amount)}`,
        10
      )
    }
  }

  y -= 10
  draw(`Total billed: ${formatPhp(params.totalAmount)}`, 11, true)
  draw(`Total paid: ${formatPhp(params.paidAmount)}`, 11)
  draw(`Balance due: ${formatPhp(balance)}`, 12, true)

  y -= 16
  draw(`Generated ${new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })}`, 9)
  draw("Official receipt for clinic records · dentali Clinic OS", 9)

  return doc.save()
}

export function pdfBytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}
