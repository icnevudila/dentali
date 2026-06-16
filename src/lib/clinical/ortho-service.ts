import { createClient } from "@/lib/supabase/client"

export interface OrthoCase {
  id: string
  patient_id: string
  branch_id: string
  status: "active" | "closed"
  appliance_type: string | null
  start_date: string | null
  contract_amount: number
  notes: string | null
  linked_invoice_id: string | null
  created_at: string
}

export interface OrthoAdjustment {
  id: string
  adjustment_date: string
  procedure: string
  next_procedure: string | null
  next_visit_date: string | null
  payment_amount: number
  notes: string | null
  created_at: string
}

export interface OrthoBalance {
  contract_amount: number
  total_paid: number
  balance: number
}

export async function fetchOrthoCase(
  patientId: string,
  branchId: string
): Promise<{ data: OrthoCase | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("ortho_cases")
    .select("id, patient_id, branch_id, status, appliance_type, start_date, contract_amount, notes, linked_invoice_id, created_at")
    .eq("patient_id", patientId)
    .eq("branch_id", branchId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  return { data: data as OrthoCase | null, error: null }
}

export async function createOrthoCase(params: {
  organizationId: string
  branchId: string
  patientId: string
  applianceType: string
  startDate: string
  contractAmount: number
  notes?: string
  userId: string
}): Promise<{ data: { id: string } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("ortho_cases")
    .insert({
      organization_id: params.organizationId,
      branch_id: params.branchId,
      patient_id: params.patientId,
      appliance_type: params.applianceType,
      start_date: params.startDate,
      contract_amount: params.contractAmount,
      notes: params.notes ?? null,
      created_by: params.userId,
    })
    .select("id")
    .single()

  if (error || !data) return { data: null, error: error?.message ?? "Failed to create case" }
  return { data: { id: data.id }, error: null }
}

export async function closeOrthoCase(caseId: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("ortho_cases")
    .update({ status: "closed", closed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", caseId)

  return { error: error?.message ?? null }
}

export async function fetchOrthoAdjustments(
  caseId: string
): Promise<{ data: OrthoAdjustment[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("ortho_adjustments")
    .select("id, adjustment_date, procedure, next_procedure, next_visit_date, payment_amount, notes, created_at")
    .eq("case_id", caseId)
    .order("adjustment_date", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as OrthoAdjustment[], error: null }
}

export async function logOrthoAdjustment(payload: {
  caseId: string
  adjustmentDate: string
  procedure: string
  nextProcedure?: string
  nextVisitDate?: string
  paymentAmount: number
  notes?: string
}): Promise<{ data: OrthoBalance | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("log_ortho_adjustment", {
    p_payload: {
      case_id: payload.caseId,
      adjustment_date: payload.adjustmentDate,
      procedure: payload.procedure,
      next_procedure: payload.nextProcedure ?? "",
      next_visit_date: payload.nextVisitDate ?? "",
      payment_amount: payload.paymentAmount,
      notes: payload.notes ?? "",
    },
  })

  if (error) return { data: null, error: error.message }
  const result = data as OrthoBalance
  return { data: result, error: null }
}

export async function fetchOrthoBalance(
  caseId: string
): Promise<{ data: OrthoBalance | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("calculate_ortho_balance", { p_case_id: caseId })

  if (error) return { data: null, error: error.message }
  return { data: data as OrthoBalance, error: null }
}

export async function revertOrthoAdjustment(
  adjustmentId: string
): Promise<{ data: OrthoBalance | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("revert_ortho_adjustment", {
    p_adjustment_id: adjustmentId,
  })
  if (error) return { data: null, error: error.message }
  return { data: data as OrthoBalance, error: null }
}

export async function updateOrthoAdjustment(payload: {
  adjustmentId: string
  adjustmentDate: string
  procedure: string
  nextProcedure?: string
  nextVisitDate?: string
  paymentAmount: number
  notes?: string
}): Promise<{ data: OrthoBalance | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("update_ortho_adjustment", {
    p_payload: {
      adjustment_id: payload.adjustmentId,
      adjustment_date: payload.adjustmentDate,
      procedure: payload.procedure,
      next_procedure: payload.nextProcedure ?? "",
      next_visit_date: payload.nextVisitDate ?? "",
      payment_amount: payload.paymentAmount,
      notes: payload.notes ?? "",
    },
  })

  if (error) return { data: null, error: error.message }
  return { data: data as OrthoBalance, error: null }
}

export async function createInvoiceFromOrthoCase(
  caseId: string
): Promise<{ data: { id: string; existing: boolean } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("create_invoice_from_ortho_case", {
    p_case_id: caseId,
  })
  if (error) return { data: null, error: error.message }
  const raw = data as { id: string; existing?: boolean }
  return { data: { id: raw.id, existing: Boolean(raw.existing) }, error: null }
}
