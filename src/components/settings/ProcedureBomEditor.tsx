"use client"

import { useCallback, useEffect, useState } from "react"
import { Package, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  deleteProcedureBomLine,
  fetchInventoryItems,
  fetchProcedureBomLines,
  upsertProcedureBomLine,
  type InventoryItem,
  type ProcedureBomLine,
} from "@/lib/inventory/inventory-service"
import { useLocale } from "@/hooks/use-locale"

type ProcedureBomEditorProps = {
  organizationId: string
  branchId: string
  procedureId: string
  procedureName: string
  onClose: () => void
}

export function ProcedureBomEditor({
  organizationId,
  branchId,
  procedureId,
  procedureName,
  onClose,
}: ProcedureBomEditorProps) {
  const { t } = useLocale()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lines, setLines] = useState<ProcedureBomLine[]>([])
  const [items, setItems] = useState<InventoryItem[]>([])
  const [selectedItemId, setSelectedItemId] = useState("")
  const [quantity, setQuantity] = useState("1")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [bomResult, itemsResult] = await Promise.all([
      fetchProcedureBomLines(procedureId),
      fetchInventoryItems(branchId),
    ])
    setLines(bomResult.data)
    setItems(itemsResult.data)
    if (bomResult.error) setError(bomResult.error)
    else if (itemsResult.error) setError(itemsResult.error)
    setLoading(false)
  }, [branchId, procedureId])

  useEffect(() => {
    void load()
  }, [load])

  const handleAdd = async () => {
    const qty = parseFloat(quantity)
    if (!selectedItemId || Number.isNaN(qty) || qty <= 0) return
    setSaving(true)
    setError(null)
    const { error: err } = await upsertProcedureBomLine({
      organizationId,
      procedureId,
      inventoryItemId: selectedItemId,
      quantity: qty,
    })
    setSaving(false)
    if (err) setError(err)
    else {
      setSelectedItemId("")
      setQuantity("1")
      await load()
    }
  }

  const handleDelete = async (lineId: string) => {
    setSaving(true)
    setError(null)
    const { error: err } = await deleteProcedureBomLine(lineId)
    setSaving(false)
    if (err) setError(err)
    else await load()
  }

  const usedIds = new Set(lines.map((l) => l.inventory_item_id))
  const availableItems = items.filter((item) => !usedIds.has(item.id))

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        className="w-full max-w-lg rounded-xl border border-neutral-200 bg-white shadow-xl"
        role="dialog"
        aria-labelledby="bom-editor-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              {t("settings.procedureBom", "Procedure BOM")}
            </p>
            <h2 id="bom-editor-title" className="text-base font-semibold text-neutral-900">
              {procedureName}
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              {t(
                "settings.procedureBomHint",
                "Materials auto-deduct from inventory when the procedure is marked served."
              )}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t("common.close", "Close")}
          </Button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}

          {loading ? (
            <p className="text-sm text-neutral-500">{t("common.loading", "Loading…")}</p>
          ) : lines.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-neutral-500">
              <Package className="h-4 w-4" aria-hidden />
              {t("settings.procedureBomEmpty", "No materials linked yet.")}
            </p>
          ) : (
            <ul className="divide-y rounded-lg border border-neutral-200">
              {lines.map((line) => (
                <li key={line.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-neutral-900">{line.item_name}</p>
                    <p className="text-xs text-neutral-500">
                      {line.quantity} {line.item_unit}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-600 hover:text-red-700"
                    disabled={saving}
                    onClick={() => void handleDelete(line.id)}
                    aria-label={t("common.remove", "Remove")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-2 sm:grid-cols-[1fr_96px_auto]">
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
              disabled={saving || availableItems.length === 0}
            >
              <option value="">
                {availableItems.length === 0
                  ? t("settings.procedureBomNoItems", "No inventory items")
                  : t("settings.procedureBomSelectItem", "Select inventory item")}
              </option>
              {availableItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.quantity_on_hand} {item.unit})
                </option>
              ))}
            </select>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={saving}
              aria-label={t("settings.procedureBomQty", "Quantity")}
            />
            <Button
              onClick={() => void handleAdd()}
              disabled={saving || !selectedItemId}
            >
              {t("common.add", "Add")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
