import { createClient } from "@/lib/supabase/client"
import { isShowcaseActive } from "@/lib/showcase/intercept"

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
  { id: "1", slug: "preventive", name: "Preventive", sort_order: 1 },
  { id: "2", slug: "restorative", name: "Restorative", sort_order: 2 },
  { id: "3", slug: "surgery", name: "Surgery", sort_order: 3 },
  { id: "4", slug: "general", name: "General", sort_order: 4 },
]

/** Local procedure cache is only for read-only marketing showcase — not production clinics. */
function allowLocalProcedureCache(): boolean {
  return isShowcaseActive()
}

function getLocalProcedures(): ProcedureRecord[] {
  if (!allowLocalProcedureCache() || typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(LOCAL_PROCEDURES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalProcedures(items: ProcedureRecord[]) {
  if (!allowLocalProcedureCache() || typeof window === "undefined") return
  try {
    localStorage.setItem(LOCAL_PROCEDURES_KEY, JSON.stringify(items))
  } catch {
    // Quota or private browsing — ignore in showcase mode
  }
}

function getLocalBranchPrices(): Record<string, number> {
  if (!allowLocalProcedureCache() || typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(LOCAL_BRANCH_PRICES_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveLocalBranchPrice(branchId: string, procedureId: string, price: number) {
  if (!allowLocalProcedureCache() || typeof window === "undefined") return
  try {
    const current = getLocalBranchPrices()
    current[`${branchId}:${procedureId}`] = price
    localStorage.setItem(LOCAL_BRANCH_PRICES_KEY, JSON.stringify(current))
  } catch {
    // ignore
  }
}

function mergeWithLocalCache(
  dbProcedures: ProcedureRecord[],
  dbCategories: ProcedureCategory[],
  branchId?: string | null
): { procedures: ProcedureRecord[]; categories: ProcedureCategory[] } {
  if (!allowLocalProcedureCache()) {
    return { procedures: dbProcedures, categories: dbCategories }
  }

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
      effective_price:
        localOverride !== null && localOverride !== undefined ? localOverride : lp.base_price,
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
  return { procedures: mergedProcedures, categories: mergedCategories }
}

export async function fetchProcedures(
  branchId?: string | null
): Promise<{ data: ProcedureRecord[]; error: string | null; categories?: ProcedureCategory[] }> {
  const supabase = createClient()
  let dbProcedures: ProcedureRecord[] = []
  let dbCategories: ProcedureCategory[] = []
  let fetchError: string | null = null

  if (branchId) {
    const { data, error } = await supabase.rpc("get_procedure_catalog", {
      p_branch_id: branchId,
    })
    if (!error && data) {
      const raw = data as {
        categories?: ProcedureCategory[]
        procedures?: Array<
          Omit<ProcedureRecord, "effective_price" | "branch_override"> & {
            effective_price: number
            branch_override: number | null
          }
        >
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
  } else {
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
  }

  const { procedures, categories } = mergeWithLocalCache(dbProcedures, dbCategories, branchId)

  if (!allowLocalProcedureCache() && fetchError && procedures.length === 0) {
    return { data: [], categories: [], error: fetchError }
  }

  return { data: procedures, categories, error: fetchError }
}

export async function getEffectiveProcedurePrice(
  procedureId: string,
  branchId: string
): Promise<{ price: number | null; error: string | null }> {
  if (allowLocalProcedureCache()) {
    const localPrices = getLocalBranchPrices()
    const localVal = localPrices[`${branchId}:${procedureId}`]
    if (localVal !== undefined && localVal !== null) {
      return { price: localVal, error: null }
    }
  }

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

  if (error) return { error: error.message }

  saveLocalBranchPrice(params.branchId, params.procedureId, params.priceOverride)
  return { error: null }
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

  if (error) return { error: error.message }

  if (allowLocalProcedureCache() && typeof window !== "undefined") {
    try {
      const current = getLocalBranchPrices()
      delete current[`${branchId}:${procedureId}`]
      localStorage.setItem(LOCAL_BRANCH_PRICES_KEY, JSON.stringify(current))
    } catch {
      // ignore
    }
  }

  return { error: null }
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

  if (error || !data) {
    if (allowLocalProcedureCache()) {
      const newLocalItem: ProcedureRecord = {
        id: `local-${crypto.randomUUID()}`,
        code: params.code ?? null,
        name: params.name,
        category: params.category ?? "general",
        base_price: params.basePrice,
        effective_price: params.basePrice,
        branch_override: null,
        tooth_required: params.toothRequired ?? false,
        is_active: true,
      }
      const localProcs = getLocalProcedures()
      localProcs.push(newLocalItem)
      saveLocalProcedures(localProcs)
      return { data: newLocalItem, error: error?.message ?? "Failed to insert procedure" }
    }
    return { data: null, error: error?.message ?? "Failed to insert procedure" }
  }

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

  if (error) {
    if (allowLocalProcedureCache()) {
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
      return { data: { inserted, updated, total: procedures.length }, error: error.message }
    }
    return { data: null, error: error.message }
  }

  const raw = data as { inserted: number; updated: number; total: number }
  return { data: raw, error: null }
}

export async function seedDefaultProcedures(orgId: string): Promise<void> {
  const defaults = [
    {
      code: "EXAM",
      name: "Oral Examination",
      category: "preventive",
      base_price: 500,
      tooth_required: false,
    },
    {
      code: "PROPH",
      name: "Prophylaxis / Cleaning",
      category: "preventive",
      base_price: 2500,
      tooth_required: false,
    },
    {
      code: "FILL",
      name: "Composite Filling",
      category: "restorative",
      base_price: 3500,
      tooth_required: true,
    },
    {
      code: "RCT",
      name: "Root Canal Treatment",
      category: "restorative",
      base_price: 12000,
      tooth_required: true,
    },
    {
      code: "EXT",
      name: "Tooth Extraction",
      category: "surgery",
      base_price: 4000,
      tooth_required: true,
    },
    {
      code: "CRWN",
      name: "Jacket Crown",
      category: "restorative",
      base_price: 15000,
      tooth_required: true,
    },
  ]

  if (allowLocalProcedureCache()) {
    const localProcs = getLocalProcedures()
    const merged = [...localProcs]
    for (const d of defaults) {
      if (!merged.some((p) => p.code === d.code)) {
        merged.push({
          id: `local-${d.code}`,
          code: d.code,
          name: d.name,
          category: d.category,
          base_price: d.base_price,
          effective_price: d.base_price,
          branch_override: null,
          tooth_required: d.tooth_required,
          is_active: true,
        })
      }
    }
    saveLocalProcedures(merged)
  }

  const supabase = createClient()
  const dbDefaults = defaults.map((d) => ({
    organization_id: orgId,
    code: d.code,
    name: d.name,
    category: d.category,
    base_price: d.base_price,
    tooth_required: d.tooth_required,
  }))

  const { error } = await supabase.from("procedures").insert(dbDefaults)
  if (error) {
    await supabase.rpc("seed_default_procedures", { p_org_id: orgId })
  }
}
