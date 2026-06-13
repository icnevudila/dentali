import { createClient } from "@/lib/supabase/client"
import { getInvoice } from "./invoice-service"
import { buildInvoicePrintHtml } from "./invoice-print"

/**
 * Opens the invoice as a printable HTML page using a Blob URL.
 * Blob URLs are NOT blocked by popup blockers (unlike data: URIs).
 */
function openHtmlInNewTab(html: string): boolean {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, "_blank")
  if (!win) {
    // If popup was blocked, try an alternative: inject into an iframe
    const iframe = document.createElement("iframe")
    iframe.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99999;border:none;background:#fff"
    iframe.src = url
    document.body.appendChild(iframe)
    // Add a close button
    const closeBtn = document.createElement("button")
    closeBtn.textContent = "✕ Close"
    closeBtn.style.cssText = "position:fixed;top:12px;right:12px;z-index:100000;padding:8px 16px;background:#0f172a;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600"
    closeBtn.onclick = () => {
      document.body.removeChild(iframe)
      document.body.removeChild(closeBtn)
      URL.revokeObjectURL(url)
    }
    document.body.appendChild(closeBtn)
    return true
  }
  // Revoke the blob URL after the window loads to free memory
  win.addEventListener("load", () => {
    // Small delay so the page has time to render
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  })
  return true
}

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

  // Fallback to client-side print layout that allows "Save as PDF"
  const { data: inv, payments, lineItems } = await getInvoice(invoiceId)
  if (!inv) {
    return { error: "Invoice not found for printing" }
  }

  const html = buildInvoicePrintHtml({
    invoice: inv,
    payments: payments || [],
    lineItems: lineItems || [],
  })

  // Use Blob URL instead of data: URI — data: URIs are blocked by modern browsers
  const opened = openHtmlInNewTab(html)
  if (!opened) {
    return { error: "Could not open invoice preview. Please check your popup blocker settings." }
  }

  return { error: null }
}
