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
  const { data, error } = await supabase.rpc("create_treatment_plan", {
    p_payload: {
      organization_id: params.organizationId,
      branch_id: params.branchId,
      patient_id: params.patientId,
      title: params.title,
    },
  })

  if (error) return { data: null, error: error.message }
  const raw = data as { id: string }
  return { data: { id: raw.id }, error: null }
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
  const { error } = await supabase.rpc("add_treatment_plan_item", {
    p_payload: {
      plan_id: params.planId,
      procedure_id: params.procedureId ?? null,
      description: params.description,
      estimated_price: params.estimatedPrice,
      tooth_number: params.toothNumber ?? null,
      priority: params.priority ?? "restorative",
    },
  })

  return { error: error?.message ?? null }
}

export async function updatePlanItem(params: {
  itemId: string
  planId: string
  description?: string
  estimatedPrice?: number
  toothNumber?: string | null
  priority?: string
}): Promise<{ error: string | null }> {
  const supabase = createClient()
  const payload: Record<string, string | number | null> = {}
  if (params.description !== undefined) payload.description = params.description
  if (params.estimatedPrice !== undefined) payload.estimated_price = params.estimatedPrice
  if (params.toothNumber !== undefined) payload.tooth_number = params.toothNumber
  if (params.priority !== undefined) payload.priority = params.priority

  const { error } = await supabase.rpc("update_treatment_plan_item", {
    p_item_id: params.itemId,
    p_plan_id: params.planId,
    p_payload: payload,
  })
  return { error: error?.message ?? null }
}

export async function deletePlanItem(
  itemId: string,
  planId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("delete_treatment_plan_item", {
    p_item_id: itemId,
    p_plan_id: planId,
  })
  return { error: error?.message ?? null }
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

export async function unapproveTreatmentPlan(planId: string): Promise<{
  data: { plan_id: string; status: string; voided_invoice_id: string | null } | null
  error: string | null
}> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("unapprove_treatment_plan", {
    p_plan_id: planId,
  })
  if (error) return { data: null, error: error.message }
  const raw = data as Record<string, unknown>
  return {
    data: {
      plan_id: String(raw.plan_id),
      status: String(raw.status),
      voided_invoice_id: raw.voided_invoice_id ? String(raw.voided_invoice_id) : null,
    },
    error: null,
  }
}

export async function updatePlanStatus(
  planId: string,
  status: string
): Promise<{ error: string | null }> {
  if (status === "approved") {
    return {
      error: "Use approveTreatmentPlan() — direct status updates bypass invoice and audit workflow.",
    }
  }
  if (status === "proposed" || status === "draft") {
    return {
      error: "Use unapproveTreatmentPlan() to revert an approved plan.",
    }
  }
  const supabase = createClient()
  const { error } = await supabase
    .from("treatment_plans")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", planId)
  return { error: error?.message ?? null }
}
