"use client"

import * as React from "react"
import { Pencil, Trash2, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BulletTextarea } from "@/components/ui/BulletTextarea"
import { BulletTextList } from "@/components/ui/BulletTextList"
import { useLocale } from "@/hooks/use-locale"
import { toStoredBulletText } from "@/lib/text/bullet-text"
import type { TreatmentPlanItem } from "@/lib/clinical/treatment-plan-service"

export function TreatmentPlanItemRow({
  item,
  editable,
  saving,
  phaseOptions,
  phaseLabel,
  onSave,
  onDelete,
}: {
  item: TreatmentPlanItem
  editable: boolean
  saving: boolean
  phaseOptions?: readonly { value: string; label: string }[]
  phaseLabel?: (value: string | null | undefined) => string
  onSave: (patch: {
    description: string
    estimatedPrice: number
    toothNumber: string | null
    priority?: string
  }) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const { t } = useLocale()
  const [editing, setEditing] = React.useState(false)
  const [description, setDescription] = React.useState(item.description)
  const [price, setPrice] = React.useState(String(item.estimated_price))
  const [tooth, setTooth] = React.useState(item.tooth_number ?? "")
  const [priority, setPriority] = React.useState(item.priority ?? "phase_1")

  const beginEditing = () => {
    setDescription(item.description)
    setPrice(String(item.estimated_price))
    setTooth(item.tooth_number ?? "")
    setPriority(item.priority ?? "phase_1")
    setEditing(true)
  }

  const handleSave = async () => {
    await onSave({
      description: toStoredBulletText(description.trim()),
      estimatedPrice: parseFloat(price) || 0,
      toothNumber: tooth.trim() || null,
      priority,
    })
    setEditing(false)
  }

  const labelForPriority = phaseLabel ?? ((value) => value?.replace(/_/g, " ") ?? "Phase")

  if (!editable) {
    return (
      <li className="py-2 flex justify-between gap-3 text-neutral-700">
        <span className="min-w-0 flex-1">
          <BulletTextList text={item.description} />
          <span className="mt-1 flex flex-wrap gap-1.5 text-xs text-neutral-500">
            {item.tooth_number ? (
              <span>{t("treatmentPlan.toothNumber", "Tooth #")} {item.tooth_number}</span>
            ) : null}
            <span>{labelForPriority(item.priority)}</span>
          </span>
        </span>
        <span className="font-medium shrink-0">₱{Number(item.estimated_price).toLocaleString()}</span>
      </li>
    )
  }

  if (editing) {
    return (
      <li className="py-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between border-b border-neutral-100">
        <div className="grid w-full flex-1 gap-2">
          <BulletTextarea
            value={description}
            onChange={setDescription}
            rows={3}
            disabled={saving}
          />
          <div className="grid gap-2 sm:grid-cols-3">
          <Input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={t("treatmentPlan.patientPrice", "Patient price (₱)")}
            min="0"
            step="0.01"
          />
          <Input
            value={tooth}
            onChange={(e) => setTooth(e.target.value)}
            placeholder={t("treatmentPlan.toothNumber", "Tooth #")}
          />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
            disabled={saving}
          >
            {(phaseOptions ?? [{ value: priority, label: labelForPriority(priority) }]).map((phase) => (
              <option key={phase.value} value={phase.value}>
                {phase.label}
              </option>
            ))}
          </select>
          </div>
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
    <li className="py-2 flex items-start justify-between gap-3">
      <span className="min-w-0 flex-1">
        <BulletTextList text={item.description} />
        <span className="mt-1 flex flex-wrap gap-1.5 text-xs text-neutral-500">
          {item.tooth_number ? (
            <span>{t("treatmentPlan.toothNumber", "Tooth #")} {item.tooth_number}</span>
          ) : null}
          <span>{labelForPriority(item.priority)}</span>
        </span>
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <span className="font-medium">₱{Number(item.estimated_price).toLocaleString()}</span>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={beginEditing} disabled={saving}>
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
