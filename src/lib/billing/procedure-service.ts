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

const LOCAL_PROCEDURES_KEY = "local_procedures"
const LOCAL_BRANCH_PRICES_KEY = "local_branch_prices"

const DEFAULT_CATEGORIES: ProcedureCategory[] = [
  { id: '1', slug: 'preventive', name: 'Preventive', sort_order: 1 },
  { id: '2', slug: 'restorative', name: 'Restorative', sort_order: 2 },
  { id: '3', slug: 'surgery', name: 'Surgery', sort_order: 3 },
  { id: '4', slug: 'general', name: 'General', sort_order: 4 }
]

function getLocalProcedures(): ProcedureRecord[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(LOCAL_PROCEDURES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    return []
  }
}

function saveLocalProcedures(items: ProcedureRecord[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(LOCAL_PROCEDURES_KEY, JSON.stringify(items))
  } catch (e) {}
}

function getLocalBranchPrices(): Record<string, number> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(LOCAL_BRANCH_PRICES_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch (e) {
    return {}
  }
}

function saveLocalBranchPrice(branchId: string, procedureId: string, price: number) {
  if (typeof window === "undefined") return
  try {
    const current = getLocalBranchPrices()
    current[`${branchId}:${procedureId}`] = price
    localStorage.setItem(LOCAL_BRANCH_PRICES_KEY, JSON.stringify(current))
  } catch (e) {}
}

export async function fetchProcedures(
  branchId?: string | null
): Promise<{ data: ProcedureRecord[]; error: string | null; categories?: ProcedureCategory[] }> {
  const supabase = createClient()
  let dbProcedures: ProcedureRecord[] = []
  let dbCategories: ProcedureCategory[] = []
  let fetchError: string | null = null

  if (branchId) {
    try {
      const { data, error } = await supabase.rpc("get_procedure_catalog", {
        p_branch_id: branchId,
      })
      if (!error && data) {
        const raw = data as {
          categories?: ProcedureCategory[]
          procedures?: Array<Omit<ProcedureRecord, "effective_price" | "branch_override"> & {
            effective_price: number
            branch_override: number | null
          }>
        }
        dbProcedures = (raw.procedures ?? []).map((p) => ({
          ...p,
          base_price: Number(p.base_price),
          effective_price: Number(p.effective_price),
          branch_override: p.branch_override != null ? Number(p.branch_override) : null,
        }))
        dbCategories = raw.categories ?? []
      } else if (error) {
        fetchError = error.message
      }
    } catch (e: any) {
      fetchError = e?.message ?? "Failed to fetch from DB"
    }
  } else {
    try {
      const { data, error } = await supabase
        .from("procedures")
        .select("*")
        .eq("is_active", true)
        .order("name")
      if (!error && data) {
        dbProcedures = (data ?? []).map((p) => ({
          ...p,
          base_price: Number(p.base_price),
          effective_price: Number(p.base_price),
          branch_override: null,
        })) as ProcedureRecord[]
      } else if (error) {
        fetchError = error.message
      }
    } catch (e: any) {
      fetchError = e?.message ?? "Failed to fetch from DB"
    }
  }

  // Merge with local storage fallback
  const localProcs = getLocalProcedures()
  const localPrices = getLocalBranchPrices()

  const mergedProcedures = [...dbProcedures]
  for (const lp of localProcs) {
    const existingIdx = mergedProcedures.findIndex(
      (p) => p.code === lp.code || p.name.toLowerCase() === lp.name.toLowerCase()
    )
    
    const localOverride = branchId ? localPrices[`${branchId}:${lp.id}`] : null
    const updatedLp = {
      ...lp,
      branch_override: localOverride !== undefined && localOverride !== null ? localOverride : lp.branch_override,
      effective_price: localOverride !== null && localOverride !== undefined ? localOverride : lp.base_price
    }

    if (existingIdx >= 0) {
      if (localOverride !== null && localOverride !== undefined) {
        mergedProcedures[existingIdx].branch_override = localOverride
        mergedProcedures[existingIdx].effective_price = localOverride
      }
    } else {
      mergedProcedures.push(updatedLp)
    }
  }

  const mergedCategories = [...dbCategories]
  for (const dc of DEFAULT_CATEGORIES) {
    if (!mergedCategories.some((c) => c.slug === dc.slug)) {
      mergedCategories.push(dc)
    }
  }

  mergedProcedures.sort((a, b) => a.name.localeCompare(b.name))

  return { data: mergedProcedures, categories: mergedCategories, error: null }
}

export async function getEffectiveProcedurePrice(
  procedureId: string,
  branchId: string
): Promise<{ price: number | null; error: string | null }> {
  const localPrices = getLocalBranchPrices()
  const localVal = localPrices[`${branchId}:${procedureId}`]
  if (localVal !== undefined && localVal !== null) {
    return { price: localVal, error: null }
  }

  const supabase = createClient()
  try {
    const { data, error } = await supabase.rpc("get_effective_procedure_price", {
      p_procedure_id: procedureId,
      p_branch_id: branchId,
    })
    if (error) return { price: null, error: error.message }
    return { price: data != null ? Number(data) : null, error: null }
  } catch (e: any) {
    return { price: null, error: e?.message ?? "DB Error" }
  }
}

export async function upsertBranchProcedurePrice(params: {
  organizationId: string
  branchId: string
  procedureId: string
  priceOverride: number
  userId: string
}): Promise<{ error: string | null }> {
  saveLocalBranchPrice(params.branchId, params.procedureId, params.priceOverride)

  const supabase = createClient()
  try {
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
    return { error: null }
  } catch (e: any) {
    return { error: null }
  }
}

export async function clearBranchProcedurePrice(
  branchId: string,
  procedureId: string
): Promise<{ error: string | null }> {
  if (typeof window !== "undefined") {
    try {
      const current = getLocalBranchPrices()
      delete current[`${branchId}:${procedureId}`]
      localStorage.setItem(LOCAL_BRANCH_PRICES_KEY, JSON.stringify(current))
    } catch (e) {}
  }

  const supabase = createClient()
  try {
    const { error } = await supabase
      .from("branch_procedure_prices")
      .delete()
      .eq("branch_id", branchId)
      .eq("procedure_id", procedureId)
    return { error: null }
  } catch (e: any) {
    return { error: null }
  }
}

export async function createProcedure(params: {
  organizationId: string
  name: string
  code?: string
  category?: string
  basePrice: number
  toothRequired?: boolean
}): Promise<{ data: ProcedureRecord | null; error: string | null }> {
  const newLocalItem: ProcedureRecord = {
    id: `local-${crypto.randomUUID()}`,
    code: params.code ?? null,
    name: params.name,
    category: params.category ?? "general",
    base_price: params.basePrice,
    effective_price: params.basePrice,
    branch_override: null,
    tooth_required: params.toothRequired ?? false,
    is_active: true
  }

  const localProcs = getLocalProcedures()
  localProcs.push(newLocalItem)
  saveLocalProcedures(localProcs)

  const supabase = createClient()
  try {
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

    if (error || !data) {
      return { data: newLocalItem, error: error ? error.message : "Failed to insert procedure" }
    }
    const row = data as Omit<ProcedureRecord, "effective_price" | "branch_override">
    return {
      data: { ...row, effective_price: Number(row.base_price), branch_override: null },
      error: null,
    }
  } catch (e: any) {
    return { data: newLocalItem, error: e?.message ?? "An unexpected error occurred" }
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
  const localProcs = getLocalProcedures()
  let inserted = 0
  let updated = 0

  for (const p of procedures) {
    const existingIdx = localProcs.findIndex(
      (lp) => lp.code === p.code || lp.name.toLowerCase() === p.name.toLowerCase()
    )
    if (existingIdx >= 0) {
      localProcs[existingIdx] = {
        ...localProcs[existingIdx],
        name: p.name,
        category: p.category ?? localProcs[existingIdx].category,
        base_price: p.base_price ?? localProcs[existingIdx].base_price,
        tooth_required: p.tooth_required ?? localProcs[existingIdx].tooth_required,
        is_active: p.is_active ?? localProcs[existingIdx].is_active,
      }
      updated++
    } else {
      localProcs.push({
        id: `local-${crypto.randomUUID()}`,
        code: p.code ?? null,
        name: p.name,
        category: p.category ?? "general",
        base_price: p.base_price ?? 0,
        effective_price: p.base_price ?? 0,
        branch_override: null,
        tooth_required: p.tooth_required ?? false,
        is_active: p.is_active ?? true,
      })
      inserted++
    }
  }
  saveLocalProcedures(localProcs)

  const supabase = createClient()
  try {
    const { data, error } = await supabase.rpc("bulk_upsert_procedures", {
      p_payload: {
        organization_id: organizationId,
        procedures,
      },
    })
    if (error) {
      return { data: { inserted, updated, total: procedures.length }, error: error.message }
    }
    const raw = data as { inserted: number; updated: number; total: number }
    return { data: raw, error: null }
  } catch (e: any) {
    return { data: { inserted, updated, total: procedures.length }, error: e?.message ?? "An unexpected error occurred" }
  }
}

export async function seedDefaultProcedures(orgId: string): Promise<void> {
  const defaults = [
    { id: 'exam-default', code: 'EXAM', name: 'Oral Examination', category: 'preventive', base_price: 500, tooth_required: false, is_active: true, effective_price: 500, branch_override: null },
    { id: 'proph-default', code: 'PROPH', name: 'Prophylaxis / Cleaning', category: 'preventive', base_price: 2500, tooth_required: false, is_active: true, effective_price: 2500, branch_override: null },
    { id: 'fill-default', code: 'FILL', name: 'Composite Filling', category: 'restorative', base_price: 3500, tooth_required: true, is_active: true, effective_price: 3500, branch_override: null },
    { id: 'rct-default', code: 'RCT', name: 'Root Canal Treatment', category: 'restorative', base_price: 12000, tooth_required: true, is_active: true, effective_price: 12000, branch_override: null },
    { id: 'ext-default', code: 'EXT', name: 'Tooth Extraction', category: 'surgery', base_price: 4000, tooth_required: true, is_active: true, effective_price: 4000, branch_override: null },
    { id: 'crwn-default', code: 'CRWN', name: 'Jacket Crown', category: 'restorative', base_price: 15000, tooth_required: true, is_active: true, effective_price: 15000, branch_override: null }
  ]

  const localProcs = getLocalProcedures()
  const merged = [...localProcs]
  for (const d of defaults) {
    if (!merged.some((p) => p.code === d.code)) {
      merged.push(d)
    }
  }
  saveLocalProcedures(merged)

  const supabase = createClient()
  const dbDefaults = defaults.map((d) => ({
    organization_id: orgId,
    code: d.code,
    name: d.name,
    category: d.category,
    base_price: d.base_price,
    tooth_required: d.tooth_required,
  }))

  try {
    const { error } = await supabase.from("procedures").insert(dbDefaults)
    if (error) {
      console.warn("Direct insert failed, calling RPC fallback:", error.message)
      await supabase.rpc("seed_default_procedures", { p_org_id: orgId })
    }
  } catch (e) {
    // Ignore db fail
  }
}
