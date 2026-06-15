"use client"

import * as React from "react"
import { Pencil, Trash2, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useLocale } from "@/hooks/use-locale"
import type { TreatmentPlanItem } from "@/lib/clinical/treatment-plan-service"

export function TreatmentPlanItemRow({
  item,
  editable,
  saving,
  onSave,
  onDelete,
}: {
  item: TreatmentPlanItem
  editable: boolean
  saving: boolean
  onSave: (patch: { description: string; estimatedPrice: number; toothNumber: string | null }) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const { t } = useLocale()
  const [editing, setEditing] = React.useState(false)
  const [description, setDescription] = React.useState(item.description)
  const [price, setPrice] = React.useState(String(item.estimated_price))
  const [tooth, setTooth] = React.useState(item.tooth_number ?? "")

  React.useEffect(() => {
    setDescription(item.description)
    setPrice(String(item.estimated_price))
    setTooth(item.tooth_number ?? "")
  }, [item])

  const handleSave = async () => {
    await onSave({
      description: description.trim(),
      estimatedPrice: parseFloat(price) || 0,
      toothNumber: tooth.trim() || null,
    })
    setEditing(false)
  }

  if (!editable) {
    return (
      <li className="py-2 flex justify-between gap-3 text-neutral-700">
        <span>
          {item.description}
          {item.tooth_number ? ` (${t("treatmentPlan.toothNumber", "Tooth #")} ${item.tooth_number})` : ""}
        </span>
        <span className="font-medium shrink-0">₱{Number(item.estimated_price).toLocaleString()}</span>
      </li>
    )
  }

  if (editing) {
    return (
      <li className="py-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between border-b border-neutral-100">
        <div className="grid gap-2 sm:grid-cols-3 flex-1">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Procedure" />
          <Input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="₱"
          />
          <Input
            value={tooth}
            onChange={(e) => setTooth(e.target.value)}
            placeholder={t("treatmentPlan.toothNumber", "Tooth #")}
          />
        </div>
        <div className="flex gap-1 shrink-0">
          <Button type="button" size="sm" onClick={handleSave} disabled={saving || !description.trim()}>
            <Check className="h-4 w-4" />
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </li>
    )
  }

  return (
    <li className="py-2 flex items-center justify-between gap-3">
      <span>
        {item.description}
        {item.tooth_number ? ` (${t("treatmentPlan.toothNumber", "Tooth #")} ${item.tooth_number})` : ""}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <span className="font-medium">₱{Number(item.estimated_price).toLocaleString()}</span>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(true)} disabled={saving}>
          <Pencil className="h-3.5 w-3.5" />
          <span className="sr-only">{t("treatmentPlan.editItem", "Edit")}</span>
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-red-600 hover:text-red-700"
          onClick={() => void onDelete()}
          disabled={saving}
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="sr-only">{t("treatmentPlan.deleteItem", "Remove")}</span>
        </Button>
      </div>
    </li>
  )
}
