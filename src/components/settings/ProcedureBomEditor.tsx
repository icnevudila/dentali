"use client"

import { useCallback, useEffect, useState } from "react"
import { Package, Trash2, X } from "lucide-react"
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
    const id = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(id)
  }, [load])

  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener("keydown", onKey)
    }
  }, [onClose, saving])

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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={() => {
        if (!saving) onClose()
      }}
    >
      <div
        className="flex max-h-[min(92vh,100dvh)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-neutral-200 bg-white shadow-xl sm:max-h-[92vh] sm:rounded-xl"
        role="dialog"
        aria-labelledby="bom-editor-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-neutral-100 px-5 py-4 sm:px-6">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-neutral-300 sm:hidden" aria-hidden />
          <div className="flex items-start justify-between gap-3">
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
            <Button variant="ghost" size="icon" onClick={onClose} disabled={saving} aria-label={t("common.close", "Close")}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:px-6">
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

          <div className="sticky bottom-0 -mx-5 mt-6 border-t border-neutral-100 bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:-mx-6 sm:px-6">
            <Button variant="outline" onClick={onClose} disabled={saving} className="h-11 w-full">
              {t("common.close", "Close")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
