import { createClient } from "@/lib/supabase/client"

export async function downloadInvoicePdf(
  invoiceId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.functions.invoke("generate-invoice-pdf", {
    body: { invoice_id: invoiceId },
  })

  if (error) return { error: error.message }

  const result = data as {
    data?: { format?: string; pdf_base64?: string; filename?: string }
    error?: string
  }
  if (result.error) return { error: result.error }

  const doc = result.data
  if (!doc?.pdf_base64 || doc.format !== "application/pdf") {
    return { error: "No PDF content returned" }
  }

  const binary = atob(doc.pdf_base64)
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
