import { createClient } from "@/lib/supabase/client"
import { getInvoice } from "./invoice-service"
import { buildInvoicePrintHtml } from "./invoice-print"

export async function downloadInvoicePdf(
  invoiceId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  
  try {
    const { data, error } = await supabase.functions.invoke("generate-invoice-pdf", {
      body: { invoice_id: invoiceId },
    })

    if (!error && data) {
      const result = data as {
        data?: { format?: string; pdf_base64?: string; filename?: string }
        error?: string
      }
      if (!result.error && result.data?.pdf_base64 && result.data.format === "application/pdf") {
        const doc = result.data
        const binary = atob(doc.pdf_base64 || "")
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

        const blob = new Blob([bytes], { type: "application/pdf" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = doc.filename ?? `invoice-${invoiceId.slice(0, 8)}.pdf`
        link.click()
        URL.revokeObjectURL(url)
        return { error: null }
      }
    }
  } catch (e) {
    // Fall back to client side printing
  }

  // Open the window synchronously *before* the async await fetches to avoid browser popup blockers
  const win = window.open("", "_blank", "noopener,noreferrer,width=860,height=960")
  if (!win) {
    return { error: "Popup window was blocked. Please allow popups to print/save this invoice." }
  }

  // Show a loading text in the popup while fetching the data
  win.document.write("<html><head><title>Loading Invoice...</title></head><body style='font-family:sans-serif;padding:40px;color:#64748b;'>Preparing invoice details...</body></html>")
  win.document.close()

  // Fallback to client-side print layout that allows "Save as PDF"
  const { data: inv, payments, lineItems } = await getInvoice(invoiceId)
  if (!inv) {
    win.close()
    return { error: "Invoice not found for printing" }
  }

  const html = buildInvoicePrintHtml({
    invoice: inv,
    payments: payments || [],
    lineItems: lineItems || [],
  })

  // Clear loading state and replace with final printed HTML
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()

  return { error: null }
}
