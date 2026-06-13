import { createClient } from "@/lib/supabase/client"

export interface ProcedureRecord {
  id: string
  code: string | null
  name: string
  category: string
  base_price: number
  effective_price: number
  branch_override: number | null
  tooth_required: boolean
  is_active: boolean
}

export interface ProcedureCategory {
  id: string
  slug: string
  name: string
  sort_order: number
}

export async function fetchProcedures(
  branchId?: string | null
): Promise<{ data: ProcedureRecord[]; error: string | null; categories?: ProcedureCategory[] }> {
  const supabase = createClient()

  if (branchId) {
    const { data, error } = await supabase.rpc("get_procedure_catalog", {
      p_branch_id: branchId,
    })

    if (error) return { data: [], error: error.message }

    const raw = data as {
      categories?: ProcedureCategory[]
      procedures?: Array<Omit<ProcedureRecord, "effective_price" | "branch_override"> & {
        effective_price: number
        branch_override: number | null
      }>
    }

    const procedures = (raw.procedures ?? []).map((p) => ({
      ...p,
      base_price: Number(p.base_price),
      effective_price: Number(p.effective_price),
      branch_override: p.branch_override != null ? Number(p.branch_override) : null,
    }))

    return { data: procedures, categories: raw.categories ?? [], error: null }
  }

  const { data, error } = await supabase
    .from("procedures")
    .select("*")
    .eq("is_active", true)
    .order("name")

  if (error) return { data: [], error: error.message }

  const procedures = (data ?? []) as Omit<ProcedureRecord, "effective_price" | "branch_override">[]

  return {
    data: procedures.map((p) => ({
      ...p,
      effective_price: Number(p.base_price),
      branch_override: null,
    })),
    error: null,
  }
}

export async function getEffectiveProcedurePrice(
  procedureId: string,
  branchId: string
): Promise<{ price: number | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_effective_procedure_price", {
    p_procedure_id: procedureId,
    p_branch_id: branchId,
  })

  if (error) return { price: null, error: error.message }
  return { price: data != null ? Number(data) : null, error: null }
}

export async function upsertBranchProcedurePrice(params: {
  organizationId: string
  branchId: string
  procedureId: string
  priceOverride: number
  userId: string
}): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.from("branch_procedure_prices").upsert(
    {
      organization_id: params.organizationId,
      branch_id: params.branchId,
      procedure_id: params.procedureId,
      price_override: params.priceOverride,
      updated_by: params.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "branch_id,procedure_id" }
  )
  return { error: error?.message ?? null }
}

export async function clearBranchProcedurePrice(
  branchId: string,
  procedureId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("branch_procedure_prices")
    .delete()
    .eq("branch_id", branchId)
    .eq("procedure_id", procedureId)
  return { error: error?.message ?? null }
}

export async function createProcedure(params: {
  organizationId: string
  name: string
  code?: string
  category?: string
  basePrice: number
  toothRequired?: boolean
}): Promise<{ data: ProcedureRecord | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("procedures")
    .insert({
      organization_id: params.organizationId,
      name: params.name,
      code: params.code ?? null,
      category: params.category ?? "general",
      base_price: params.basePrice,
      tooth_required: params.toothRequired ?? false,
    })
    .select("*")
    .single()

  if (error || !data) return { data: null, error: error?.message ?? "Failed" }
  const row = data as Omit<ProcedureRecord, "effective_price" | "branch_override">
  return {
    data: { ...row, effective_price: Number(row.base_price), branch_override: null },
    error: null,
  }
}

export async function bulkUpsertProcedures(
  organizationId: string,
  procedures: Array<{
    code?: string
    name: string
    category?: string
    base_price?: number
    tooth_required?: boolean
    is_active?: boolean
  }>
): Promise<{ data: { inserted: number; updated: number; total: number } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("bulk_upsert_procedures", {
    p_payload: {
      organization_id: organizationId,
      procedures,
    },
  })

  if (error) return { data: null, error: error.message }
  const raw = data as { inserted: number; updated: number; total: number }
  return { data: raw, error: null }
}

export async function seedDefaultProcedures(orgId: string): Promise<void> {
  const supabase = createClient()
  await supabase.rpc("seed_default_procedures", { p_org_id: orgId })
}
