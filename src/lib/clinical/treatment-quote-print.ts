import { createClient } from "@/lib/supabase/client"
import {
  fetchPatientTreatmentPlans,
  getTreatmentPlan,
} from "@/lib/clinical/treatment-plan-service"
import {
  getInvoice,
  getLinkedInvoiceForPlan,
} from "@/lib/billing/invoice-service"
import { fetchBranchContext } from "@/lib/org/branch-context-service"

export type TreatmentQuoteLine = {
  description: string
  tooth_number: string | null
  /** Amount in PHP major units as stored/displayed by treatment plans & invoices. */
  fee: number
}

export type TreatmentQuotePrintData = {
  patient_name: string
  clinic_name: string
  plan_title: string | null
  quote_date: string
  lines: TreatmentQuoteLine[]
  subtotal: number
  discount: number
  net_total: number
  source: "treatment_plan" | "invoice"
  invoice_number?: string | null
}

function formatPatientName(row: {
  first_name?: string | null
  last_name?: string | null
} | null): string {
  if (!row) return "Patient"
  return `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "Patient"
}

/** Format PHP amounts for print (en-PH). Values are major units as used elsewhere in billing UI. */
export function formatQuotePhp(amount: number): string {
  return `₱${Number(amount || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export async function fetchTreatmentQuotePrintData(
  patientId: string,
  branchId?: string | null
): Promise<{ data: TreatmentQuotePrintData | null; error: string | null }> {
  const supabase = createClient()

  const [{ data: patient, error: patientError }, branchResult, plansResult] = await Promise.all([
    supabase
      .from("patients")
      .select("first_name, last_name")
      .eq("id", patientId)
      .maybeSingle(),
    branchId ? fetchBranchContext(branchId) : Promise.resolve({ data: null, error: null }),
    fetchPatientTreatmentPlans(patientId),
  ])

  if (patientError) return { data: null, error: patientError.message }
  if (plansResult.error) return { data: null, error: plansResult.error }

  const clinicName = branchResult.data?.branch_name?.trim() || "Clinic"
  const patientName = formatPatientName(patient)

  const plans = [...plansResult.data].sort((a, b) => {
    const rank = (status: string) => (status === "approved" ? 0 : status === "draft" ? 1 : 2)
    const byStatus = rank(a.status) - rank(b.status)
    if (byStatus !== 0) return byStatus
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  for (const summary of plans) {
    const { plan, items, error } = await getTreatmentPlan(summary.id)
    if (error) continue
    const activeItems = items.filter((item) => item.status !== "cancelled")
    if (activeItems.length === 0) continue

    const linked = await getLinkedInvoiceForPlan(summary.id)
    if (linked.data) {
      const invoice = await getInvoice(linked.data.id)
      if (!invoice.error && invoice.lineItems.length > 0 && invoice.data) {
        const subtotal = invoice.data.subtotal_amount
        const discount = invoice.data.discount_amount
        return {
          data: {
            patient_name: invoice.data.patient_name ?? patientName,
            clinic_name: clinicName,
            plan_title: plan?.title ?? summary.title,
            quote_date: invoice.data.created_at,
            lines: invoice.lineItems.map((line) => ({
              description: line.description,
              tooth_number: line.tooth_number,
              fee: line.line_total,
            })),
            subtotal,
            discount,
            net_total: invoice.data.total_amount,
            source: "invoice",
            invoice_number: invoice.data.invoice_number,
          },
          error: null,
        }
      }
    }

    const subtotal = activeItems.reduce((sum, item) => sum + Number(item.estimated_price || 0), 0)
    return {
      data: {
        patient_name: patientName,
        clinic_name: clinicName,
        plan_title: plan?.title ?? summary.title,
        quote_date: plan?.created_at ?? summary.created_at,
        lines: activeItems.map((item) => ({
          description: item.description,
          tooth_number: item.tooth_number,
          fee: Number(item.estimated_price || 0),
        })),
        subtotal,
        discount: 0,
        net_total: Number(plan?.total_estimated ?? subtotal),
        source: "treatment_plan",
        invoice_number: null,
      },
      error: null,
    }
  }

  // Fallback: latest non-void invoice for this patient with line items
  const { data: invoiceRow, error: invoiceError } = await supabase
    .from("invoices")
    .select("id")
    .eq("patient_id", patientId)
    .neq("status", "void")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (invoiceError) return { data: null, error: invoiceError.message }
  if (invoiceRow?.id) {
    const invoice = await getInvoice(invoiceRow.id)
    if (!invoice.error && invoice.data && invoice.lineItems.length > 0) {
      return {
        data: {
          patient_name: invoice.data.patient_name ?? patientName,
          clinic_name: clinicName,
          plan_title: null,
          quote_date: invoice.data.created_at,
          lines: invoice.lineItems.map((line) => ({
            description: line.description,
            tooth_number: line.tooth_number,
            fee: line.line_total,
          })),
          subtotal: invoice.data.subtotal_amount,
          discount: invoice.data.discount_amount,
          net_total: invoice.data.total_amount,
          source: "invoice",
          invoice_number: invoice.data.invoice_number,
        },
        error: null,
      }
    }
  }

  return { data: null, error: null }
}
