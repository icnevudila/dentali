import { createClient } from "@/lib/supabase/client"

export interface InventoryItem {
  id: string
  name: string
  sku: string | null
  category: string | null
  unit: string
  quantity_on_hand: number
  min_stock_level: number
  expiry_date: string | null
  is_active: boolean
}

export type StockLevel = "ok" | "low" | "critical" | "expired"

export function suggestedReorderQty(item: {
  quantity_on_hand: number
  min_stock_level: number
}): number {
  if (item.min_stock_level <= 0) return 0
  const target = Math.max(item.min_stock_level * 2, item.min_stock_level + 1)
  const gap = target - item.quantity_on_hand
  return gap > 0 ? Math.ceil(gap) : 0
}

export function stockLevel(item: InventoryItem): StockLevel {
  if (item.expiry_date && new Date(item.expiry_date) < new Date()) return "expired"
  if (item.quantity_on_hand <= 0) return "critical"
  if (item.quantity_on_hand <= item.min_stock_level) return "low"
  return "ok"
}

export async function fetchInventoryItems(
  branchId: string
): Promise<{ data: InventoryItem[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("inventory_items")
    .select("id, name, sku, category, unit, quantity_on_hand, min_stock_level, expiry_date, is_active")
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("name")

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []).map((r) => ({ ...r, quantity_on_hand: Number(r.quantity_on_hand), min_stock_level: Number(r.min_stock_level) })), error: null }
}

export async function createInventoryItem(params: {
  organizationId: string
  branchId: string
  name: string
  sku?: string
  category?: string
  unit?: string
  minStockLevel: number
  expiryDate?: string
  initialQty: number
  userId: string
}): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("inventory_items")
    .insert({
      organization_id: params.organizationId,
      branch_id: params.branchId,
      name: params.name,
      sku: params.sku ?? null,
      category: params.category ?? null,
      unit: params.unit ?? "pc",
      min_stock_level: params.minStockLevel,
      expiry_date: params.expiryDate ?? null,
      quantity_on_hand: 0,
      created_by: params.userId,
    })
    .select("id")
    .single()

  if (error || !data) return { error: error?.message ?? "Failed" }
  if (params.initialQty > 0) {
    await supabase.rpc("adjust_inventory_stock", {
      p_item_id: data.id,
      p_movement_type: "in",
      p_quantity: params.initialQty,
      p_notes: "Initial stock",
    })
  }
  return { error: null }
}

export interface LowStockAlert {
  id: string
  name: string
  sku: string | null
  quantity_on_hand: number
  min_stock_level: number
  unit: string
  expiry_date: string | null
  alert_type: "low" | "critical" | "expired"
}

export async function fetchLowStockAlerts(
  branchId: string
): Promise<{ data: LowStockAlert[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_inventory_low_stock_alerts", {
    p_branch_id: branchId,
  })
  if (error) return { data: [], error: error.message }
  return {
    data: ((data ?? []) as LowStockAlert[]).map((row) => ({
      ...row,
      quantity_on_hand: Number(row.quantity_on_hand),
      min_stock_level: Number(row.min_stock_level),
    })),
    error: null,
  }
}

export async function adjustInventoryStock(
  itemId: string,
  movementType: "in" | "out" | "adjustment",
  quantity: number,
  notes?: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("adjust_inventory_stock", {
    p_item_id: itemId,
    p_movement_type: movementType,
    p_quantity: quantity,
    p_notes: notes ?? null,
  })
  return { error: error?.message ?? null }
}

export type ProcedureBomLine = {
  id: string
  procedure_id: string
  inventory_item_id: string
  quantity: number
  item_name: string
  item_unit: string
}

export async function fetchProcedureBomLines(
  procedureId: string
): Promise<{ data: ProcedureBomLine[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("procedure_bom_lines")
    .select("id, procedure_id, inventory_item_id, quantity, inventory_items(name, unit)")
    .eq("procedure_id", procedureId)
    .order("created_at")

  if (error) return { data: [], error: error.message }

  return {
    data: (data ?? []).map((row) => {
      const item = row.inventory_items as { name: string; unit: string } | { name: string; unit: string }[] | null
      const itemRow = Array.isArray(item) ? item[0] : item
      return {
        id: row.id as string,
        procedure_id: row.procedure_id as string,
        inventory_item_id: row.inventory_item_id as string,
        quantity: Number(row.quantity),
        item_name: itemRow?.name ?? "—",
        item_unit: itemRow?.unit ?? "pc",
      }
    }),
    error: null,
  }
}

export async function upsertProcedureBomLine(params: {
  organizationId: string
  procedureId: string
  inventoryItemId: string
  quantity: number
}): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.from("procedure_bom_lines").upsert(
    {
      organization_id: params.organizationId,
      procedure_id: params.procedureId,
      inventory_item_id: params.inventoryItemId,
      quantity: params.quantity,
    },
    { onConflict: "procedure_id,inventory_item_id" }
  )
  return { error: error?.message ?? null }
}

export async function deleteProcedureBomLine(lineId: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.from("procedure_bom_lines").delete().eq("id", lineId)
  return { error: error?.message ?? null }
}

export async function fetchProcedureStockWarnings(
  branchId: string,
  procedureId: string
): Promise<{
  data: { name: string; quantity_on_hand: number; min_stock_level: number }[]
  error: string | null
}> {
  const supabase = createClient()
  const { data: bom, error: bomError } = await supabase
    .from("procedure_bom_lines")
    .select("inventory_item_id")
    .eq("procedure_id", procedureId)

  if (bomError) return { data: [], error: bomError.message }
  if (!bom?.length) return { data: [], error: null }

  const itemIds = bom.map((b) => b.inventory_item_id)
  const { data: items, error: itemsError } = await supabase
    .from("inventory_items")
    .select("name, quantity_on_hand, min_stock_level")
    .eq("branch_id", branchId)
    .in("id", itemIds)

  if (itemsError) return { data: [], error: itemsError.message }

  const warnings = (items ?? [])
    .map((item) => ({
      name: item.name as string,
      quantity_on_hand: Number(item.quantity_on_hand),
      min_stock_level: Number(item.min_stock_level),
    }))
    .filter((item) => item.quantity_on_hand <= item.min_stock_level)

  return { data: warnings, error: null }
}
