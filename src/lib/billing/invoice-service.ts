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
  series?: string | null
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
    .select("id, invoice_number, total_amount, paid_amount, status, patient_id, created_at, due_date, series, patients(first_name, last_name)")
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
        series: row.series,
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
  series?: string
  invoiceNumber?: string
}): Promise<{ data: { id: string } | null; error: string | null }> {
  if (params.totalAmount <= 0) {
    return { data: null, error: "Amount must be greater than zero" }
  }

  const supabase = createClient()
  const series = params.series || "INV"
  const invoiceNumber = params.invoiceNumber?.trim() || `${series}-${Date.now().toString(36).toUpperCase()}`

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      organization_id: params.organizationId,
      branch_id: params.branchId,
      patient_id: params.patientId,
      invoice_number: invoiceNumber,
      series: series,
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
  series?: string
}): Promise<{ data: { id: string } | null; error: string | null }> {
  const existing = await getLinkedInvoiceForPlan(params.treatmentPlanId)
  if (existing.error) return { data: null, error: existing.error }
  if (existing.data) return { data: { id: existing.data.id }, error: null }

  const supabase = createClient()
  const series = params.series || "INV"
  const invoiceNumber = `${series}-${Date.now().toString(36).toUpperCase()}`

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      organization_id: params.organizationId,
      branch_id: params.branchId,
      patient_id: params.patientId,
      treatment_plan_id: params.treatmentPlanId,
      invoice_number: invoiceNumber,
      series: series,
      total_amount: 0,
      status: "draft",
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

export async function addInvoiceLineItem(params: {
  invoiceId: string
  description: string
  unitPrice: number
  quantity?: number
  toothNumber?: string | null
  procedureId?: string | null
  treatmentPlanItemId?: string | null
}): Promise<{ error: string | null }> {
  return insertInvoiceLineItem(params)
}

export async function backfillPatientPlanInvoices(params: {
  patientId?: string
  branchId?: string
}): Promise<{ data: { created: number } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("backfill_patient_plan_invoices", {
    p_patient_id: params.patientId ?? null,
    p_branch_id: params.branchId ?? null,
  })
  if (error) return { data: null, error: error.message }
  const raw = data as { created?: number }
  return { data: { created: Number(raw.created ?? 0) }, error: null }
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

export async function getLinkedInvoiceForPlan(
  treatmentPlanId: string
): Promise<{ data: { id: string; status: string } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("invoices")
    .select("id, status")
    .eq("treatment_plan_id", treatmentPlanId)
    .neq("status", "void")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  if (!data) return { data: null, error: null }
  return { data: { id: data.id, status: data.status }, error: null }
}

export async function resyncDraftInvoiceFromPlan(
  invoiceId: string,
  treatmentPlanId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { data: inv, error: invErr } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", invoiceId)
    .maybeSingle()

  if (invErr) return { error: invErr.message }
  if (!inv || inv.status !== "draft") return { error: null }

  const { error: delErr } = await supabase.from("invoice_line_items").delete().eq("invoice_id", invoiceId)
  if (delErr) return { error: delErr.message }

  return seedLineItemsFromTreatmentPlan(invoiceId, treatmentPlanId)
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
  invoice_open_balance: number
  ortho_open_balance: number
  total_billed: number
  total_paid: number
  open_invoice_count: number
}

export interface PatientBillingGate extends PatientBalance {
  approved_plans_missing_invoice: Array<{
    plan_id: string
    title: string
    total_estimated: number
  }>
  primary_open_invoice_id: string | null
  has_billing_gap: boolean
  can_checkout: boolean
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
      invoice_open_balance: Number(raw.invoice_open_balance ?? raw.open_balance ?? 0),
      ortho_open_balance: Number(raw.ortho_open_balance ?? 0),
      total_billed: Number(raw.total_billed ?? 0),
      total_paid: Number(raw.total_paid ?? 0),
      open_invoice_count: Number(raw.open_invoice_count ?? 0),
    },
    error: null,
  }
}

export async function getPatientBillingGate(
  patientId: string
): Promise<{ data: PatientBillingGate | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_patient_billing_gate", {
    p_patient_id: patientId,
  })

  if (error) return { data: null, error: error.message }
  const raw = data as Record<string, unknown>
  const missing = raw.approved_plans_missing_invoice
  const missingList = Array.isArray(missing)
    ? missing.map((row) => {
        const item = row as Record<string, unknown>
        return {
          plan_id: String(item.plan_id),
          title: String(item.title ?? "Treatment plan"),
          total_estimated: Number(item.total_estimated ?? 0),
        }
      })
    : []

  return {
    data: {
      patient_id: String(raw.patient_id),
      open_balance: Number(raw.open_balance ?? 0),
      invoice_open_balance: Number(raw.invoice_open_balance ?? 0),
      ortho_open_balance: Number(raw.ortho_open_balance ?? 0),
      total_billed: Number(raw.total_billed ?? 0),
      total_paid: Number(raw.total_paid ?? 0),
      open_invoice_count: Number(raw.open_invoice_count ?? 0),
      approved_plans_missing_invoice: missingList,
      primary_open_invoice_id: raw.primary_open_invoice_id
        ? String(raw.primary_open_invoice_id)
        : null,
      has_billing_gap: Boolean(raw.has_billing_gap),
      can_checkout: Boolean(raw.can_checkout),
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

export async function deleteInvoicePayment(
  paymentId: string,
  _invoiceId?: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("delete_invoice_payment", {
    p_payment_id: paymentId,
  })
  return { error: error?.message ?? null }
}

export async function updateInvoiceLineItem(params: {
  itemId: string
  invoiceId: string
  description: string
  unitPrice: number
  quantity: number
}): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("update_invoice_line_item", {
    p_item_id: params.itemId,
    p_description: params.description,
    p_unit_price: params.unitPrice,
    p_quantity: params.quantity,
  })
  return { error: error?.message ?? null }
}
