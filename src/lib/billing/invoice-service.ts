import { createClient } from "@/lib/supabase/client"
import { getShowcaseSnapshot } from "@/lib/showcase/intercept"

export interface InvoiceRecord {
  id: string
  invoice_number: string | null
  total_amount: number
  paid_amount: number
  status: string
  patient_id: string
  created_at: string
  due_date?: string | null
  patient_name?: string
}

export async function fetchInvoices(
  branchId: string
): Promise<{ data: InvoiceRecord[]; error: string | null }> {
  const showcase = getShowcaseSnapshot()
  if (showcase && branchId === showcase.branch.id) {
    return { data: showcase.invoices, error: null }
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, total_amount, paid_amount, status, patient_id, created_at, due_date, patients(first_name, last_name)")
    .eq("branch_id", branchId)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) return { data: [], error: error.message }

  return {
    data: (data ?? []).map((row) => {
      const p = row.patients as { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
      const patient = Array.isArray(p) ? p[0] : p
      return {
        id: row.id,
        invoice_number: row.invoice_number,
        total_amount: Number(row.total_amount),
        paid_amount: Number(row.paid_amount),
        status: row.status,
        patient_id: row.patient_id,
        created_at: row.created_at,
        due_date: row.due_date,
        patient_name: patient ? `${patient.first_name} ${patient.last_name}` : undefined,
      }
    }),
    error: null,
  }
}

export type InvoiceStatusFilter = "all" | "open" | "paid" | "void"

export function filterInvoicesByStatus(
  invoices: InvoiceRecord[],
  filter: InvoiceStatusFilter
): InvoiceRecord[] {
  if (filter === "all") return invoices
  if (filter === "void") return invoices.filter((inv) => inv.status === "void")
  if (filter === "paid") return invoices.filter((inv) => inv.status === "paid")
  return invoices.filter(
    (inv) => inv.status !== "void" && inv.status !== "paid" && inv.total_amount - inv.paid_amount > 0
  )
}

export function filterOverdueInvoices(invoices: InvoiceRecord[]): InvoiceRecord[] {
  const today = new Date().toISOString().slice(0, 10)
  return invoices.filter(
    (inv) =>
      (inv.status === "sent" || inv.status === "partial") &&
      inv.due_date != null &&
      inv.due_date < today &&
      inv.total_amount - inv.paid_amount > 0
  )
}

export async function createManualInvoice(params: {
  organizationId: string
  branchId: string
  patientId: string
  totalAmount: number
  dueDate?: string
  userId: string
}): Promise<{ data: { id: string } | null; error: string | null }> {
  if (params.totalAmount <= 0) {
    return { data: null, error: "Amount must be greater than zero" }
  }

  const supabase = createClient()
  const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      organization_id: params.organizationId,
      branch_id: params.branchId,
      patient_id: params.patientId,
      invoice_number: invoiceNumber,
      total_amount: 0,
      status: "sent",
      due_date: params.dueDate ?? null,
      created_by: params.userId,
    })
    .select("id")
    .single()

  if (error || !data) return { data: null, error: error?.message ?? "Failed" }

  const lineErr = await insertInvoiceLineItem({
    invoiceId: data.id,
    description: "Clinical services",
    unitPrice: params.totalAmount,
  })
  if (lineErr.error) return { data: null, error: lineErr.error }

  return { data: { id: data.id }, error: null }
}

export async function createInvoiceFromPlan(params: {
  organizationId: string
  branchId: string
  patientId: string
  treatmentPlanId: string
  totalAmount: number
  userId: string
}): Promise<{ data: { id: string } | null; error: string | null }> {
  const supabase = createClient()
  const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      organization_id: params.organizationId,
      branch_id: params.branchId,
      patient_id: params.patientId,
      treatment_plan_id: params.treatmentPlanId,
      invoice_number: invoiceNumber,
      total_amount: 0,
      status: "sent",
      created_by: params.userId,
    })
    .select("id")
    .single()

  if (error || !data) return { data: null, error: error?.message ?? "Failed" }

  const lineErr = await seedLineItemsFromTreatmentPlan(data.id, params.treatmentPlanId)
  if (lineErr.error) return { data: null, error: lineErr.error }

  return { data: { id: data.id }, error: null }
}

export interface InvoiceDetail extends InvoiceRecord {
  treatment_plan_id: string | null
  due_date: string | null
}

export interface InvoicePayment {
  id: string
  amount: number
  payment_method: string
  notes: string | null
  created_at: string
}

export interface InvoiceLineItem {
  id: string
  description: string
  tooth_number: string | null
  quantity: number
  unit_price: number
  line_total: number
  sort_order: number
}

async function insertInvoiceLineItem(params: {
  invoiceId: string
  description: string
  unitPrice: number
  quantity?: number
  toothNumber?: string | null
  procedureId?: string | null
  treatmentPlanItemId?: string | null
}): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("add_invoice_line_item", {
    p_invoice_id: params.invoiceId,
    p_description: params.description,
    p_unit_price: params.unitPrice,
    p_quantity: params.quantity ?? 1,
    p_tooth_number: params.toothNumber ?? null,
    p_procedure_id: params.procedureId ?? null,
    p_treatment_plan_item_id: params.treatmentPlanItemId ?? null,
  })
  return { error: error?.message ?? null }
}

async function seedLineItemsFromTreatmentPlan(
  invoiceId: string,
  treatmentPlanId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { data: items, error } = await supabase
    .from("treatment_plan_items")
    .select("id, description, estimated_price, tooth_number, procedure_id")
    .eq("plan_id", treatmentPlanId)
    .neq("status", "cancelled")
    .order("created_at")

  if (error) return { error: error.message }
  if (!items?.length) {
    return insertInvoiceLineItem({
      invoiceId,
      description: "Treatment plan services",
      unitPrice: 0,
    })
  }

  for (const item of items) {
    const lineErr = await insertInvoiceLineItem({
      invoiceId,
      description: item.description,
      unitPrice: Number(item.estimated_price),
      toothNumber: item.tooth_number,
      procedureId: item.procedure_id,
      treatmentPlanItemId: item.id,
    })
    if (lineErr.error) return lineErr
  }
  return { error: null }
}

export async function getInvoice(
  invoiceId: string
): Promise<{
  data: InvoiceDetail | null
  payments: InvoicePayment[]
  lineItems: InvoiceLineItem[]
  error: string | null
}> {
  const supabase = createClient()

  const { data: inv, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, total_amount, paid_amount, status, patient_id, created_at, treatment_plan_id, due_date, patients(first_name, last_name)")
    .eq("id", invoiceId)
    .maybeSingle()

  if (error || !inv) return { data: null, payments: [], lineItems: [], error: error?.message ?? "Not found" }

  const p = inv.patients as { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
  const patient = Array.isArray(p) ? p[0] : p

  const { data: payments } = await supabase
    .from("invoice_payments")
    .select("id, amount, payment_method, notes, created_at")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false })

  const { data: lineRows } = await supabase
    .from("invoice_line_items")
    .select("id, description, tooth_number, quantity, unit_price, line_total, sort_order")
    .eq("invoice_id", invoiceId)
    .order("sort_order")

  return {
    data: {
      id: inv.id,
      invoice_number: inv.invoice_number,
      total_amount: Number(inv.total_amount),
      paid_amount: Number(inv.paid_amount),
      status: inv.status,
      patient_id: inv.patient_id,
      created_at: inv.created_at,
      treatment_plan_id: inv.treatment_plan_id,
      due_date: inv.due_date,
      patient_name: patient ? `${patient.first_name} ${patient.last_name}` : undefined,
    },
    payments: (payments ?? []).map((row) => ({
      id: row.id,
      amount: Number(row.amount),
      payment_method: row.payment_method,
      notes: row.notes,
      created_at: row.created_at,
    })),
    lineItems: (lineRows ?? []).map((row) => ({
      id: row.id,
      description: row.description,
      tooth_number: row.tooth_number,
      quantity: Number(row.quantity),
      unit_price: Number(row.unit_price),
      line_total: Number(row.line_total),
      sort_order: row.sort_order,
    })),
    error: null,
  }
}

export async function recordInvoicePayment(params: {
  invoiceId: string
  amount: number
  paymentMethod?: string
  notes?: string
}): Promise<{ data: { paid_amount: number; status: string; balance: number } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("record_invoice_payment", {
    p_invoice_id: params.invoiceId,
    p_amount: params.amount,
    p_payment_method: params.paymentMethod ?? "cash",
    p_notes: params.notes ?? null,
  })

  if (error) return { data: null, error: error.message }
  const raw = data as { paid_amount: number; status: string; balance: number }
  return {
    data: {
      paid_amount: Number(raw.paid_amount),
      status: raw.status,
      balance: Number(raw.balance),
    },
    error: null,
  }
}

export interface PatientBalance {
  patient_id: string
  open_balance: number
  total_billed: number
  total_paid: number
  open_invoice_count: number
}

export async function getPatientBalance(
  patientId: string
): Promise<{ data: PatientBalance | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_patient_balance", {
    p_patient_id: patientId,
  })

  if (error) return { data: null, error: error.message }
  const raw = data as Record<string, unknown>
  return {
    data: {
      patient_id: String(raw.patient_id),
      open_balance: Number(raw.open_balance ?? 0),
      total_billed: Number(raw.total_billed ?? 0),
      total_paid: Number(raw.total_paid ?? 0),
      open_invoice_count: Number(raw.open_invoice_count ?? 0),
    },
    error: null,
  }
}

export async function voidInvoice(
  invoiceId: string,
  reason: string
): Promise<{ data: { status: string } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("void_invoice", {
    p_invoice_id: invoiceId,
    p_reason: reason,
  })

  if (error) return { data: null, error: error.message }
  const raw = data as { status: string }
  return { data: { status: raw.status }, error: null }
}
