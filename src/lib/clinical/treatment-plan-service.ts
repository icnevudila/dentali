import { createClient } from "@/lib/supabase/client"

export interface TreatmentPlanSummary {
  id: string
  title: string
  status: string
  total_estimated: number
  created_at: string
  item_count: number
}

export interface TreatmentTimelineEntry {
  plan_id: string
  plan_title: string
  plan_status: string
  plan_created_at: string
  plan_approved_at: string | null
  item_id: string
  description: string
  tooth_number: string | null
  priority: string
  item_status: string
  estimated_price: number
  item_created_at: string
}

export async function fetchPatientTreatmentTimeline(
  patientId: string,
  branchId?: string | null
): Promise<{ data: TreatmentTimelineEntry[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_patient_treatment_timeline", {
    p_patient_id: patientId,
    p_branch_id: branchId ?? null,
  })
  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as TreatmentTimelineEntry[], error: null }
}

export interface TreatmentPlanItem {
  id: string
  plan_id: string
  procedure_id: string | null
  tooth_number: string | null
  description: string
  estimated_price: number
  priority: string
  status: string
}

export async function fetchPatientTreatmentPlans(
  patientId: string
): Promise<{ data: TreatmentPlanSummary[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_patient_treatment_plans", {
    p_patient_id: patientId,
  })
  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as TreatmentPlanSummary[], error: null }
}

export async function getTreatmentPlan(planId: string): Promise<{
  plan: TreatmentPlanSummary | null
  items: TreatmentPlanItem[]
  error: string | null
}> {
  const supabase = createClient()
  const { data: plan, error: planError } = await supabase
    .from("treatment_plans")
    .select("id, title, status, total_estimated, created_at")
    .eq("id", planId)
    .maybeSingle()

  if (planError || !plan) return { plan: null, items: [], error: planError?.message ?? "Not found" }

  const { data: items, error: itemsError } = await supabase
    .from("treatment_plan_items")
    .select("*")
    .eq("plan_id", planId)
    .order("created_at")

  return {
    plan: { ...plan, item_count: items?.length ?? 0 } as TreatmentPlanSummary,
    items: (items ?? []) as TreatmentPlanItem[],
    error: itemsError?.message ?? null,
  }
}

export async function createTreatmentPlan(params: {
  organizationId: string
  branchId: string
  patientId: string
  title: string
  userId: string
}): Promise<{ data: { id: string } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("treatment_plans")
    .insert({
      organization_id: params.organizationId,
      branch_id: params.branchId,
      patient_id: params.patientId,
      title: params.title,
      status: "proposed",
      created_by: params.userId,
    })
    .select("id")
    .single()

  if (error || !data) return { data: null, error: error?.message ?? "Failed" }
  return { data: { id: data.id }, error: null }
}

export async function addPlanItem(params: {
  planId: string
  procedureId?: string
  description: string
  estimatedPrice: number
  toothNumber?: string
  priority?: string
}): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.from("treatment_plan_items").insert({
    plan_id: params.planId,
    procedure_id: params.procedureId ?? null,
    description: params.description,
    estimated_price: params.estimatedPrice,
    tooth_number: params.toothNumber ?? null,
    priority: params.priority ?? "restorative",
  })

  if (error) return { error: error.message }

  const { error: estimateError } = await supabase.rpc("calculate_treatment_estimate", {
    p_plan_id: params.planId,
  })

  return { error: estimateError?.message ?? null }
}

export async function bulkAddChartFindingsToPlan(
  planId: string
): Promise<{ data: { added: number } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("bulk_add_chart_findings_to_plan", {
    p_plan_id: planId,
  })
  if (error) return { data: null, error: error.message }
  const raw = data as { added?: number }
  return { data: { added: Number(raw.added ?? 0) }, error: null }
}

export async function calculateTreatmentEstimate(planId: string): Promise<{
  data: { total_estimated: number; item_count: number; status: string } | null
  error: string | null
}> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("calculate_treatment_estimate", {
    p_plan_id: planId,
  })

  if (error) return { data: null, error: error.message }
  const raw = data as Record<string, unknown>
  return {
    data: {
      total_estimated: Number(raw.total_estimated ?? 0),
      item_count: Number(raw.item_count ?? 0),
      status: String(raw.status ?? ""),
    },
    error: null,
  }
}

export async function approveTreatmentPlan(planId: string): Promise<{
  data: {
    total_estimated: number
    status: string
    invoice_id: string | null
    hmo_claim_id: string | null
  } | null
  error: string | null
}> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("approve_treatment_plan", {
    p_plan_id: planId,
  })

  if (error) return { data: null, error: error.message }
  const raw = data as Record<string, unknown>
  return {
    data: {
      total_estimated: Number(raw.total_estimated ?? 0),
      status: String(raw.status ?? "approved"),
      invoice_id: raw.invoice_id ? String(raw.invoice_id) : null,
      hmo_claim_id: raw.hmo_claim_id ? String(raw.hmo_claim_id) : null,
    },
    error: null,
  }
}

export async function updatePlanStatus(
  planId: string,
  status: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (status === "approved") patch.approved_at = new Date().toISOString()

  const { error } = await supabase.from("treatment_plans").update(patch).eq("id", planId)
  return { error: error?.message ?? null }
}
