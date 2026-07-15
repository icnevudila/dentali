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
      <tr className="hover:bg-neutral-50/50 transition-colors border-b border-neutral-100 last:border-0">
        <td className="py-2.5 px-3 font-mono font-medium text-neutral-700 text-xs">
          {item.tooth_number ? `${t("treatmentPlan.toothNumber", "Tooth #")} ${item.tooth_number}` : "—"}
        </td>
        <td className="py-2.5 px-3 text-neutral-700">
          <BulletTextList text={item.description} />
        </td>
        <td className="py-2.5 px-3 text-xs text-neutral-500">
          {labelForPriority(item.priority)}
        </td>
        <td className="py-2.5 px-3 text-right font-medium text-neutral-900">
          ₱{Number(item.estimated_price).toLocaleString()}
        </td>
        <td></td>
      </tr>
    )
  }

  if (editing) {
    return (
      <tr className="bg-primary-50/20">
        <td colSpan={5} className="p-3">
          <div className="grid w-full gap-3">
            <BulletTextarea
              value={description}
              onChange={setDescription}
              rows={3}
              disabled={saving}
            />
            <div className="grid gap-2 sm:grid-cols-4 items-end">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase">Tooth #</label>
                <Input
                  value={tooth}
                  onChange={(e) => setTooth(e.target.value)}
                  placeholder={t("treatmentPlan.toothNumber", "Tooth #")}
                  disabled={saving}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase">Price (₱)</label>
                <Input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder={t("treatmentPlan.patientPrice", "Price (₱)")}
                  min="0"
                  step="0.01"
                  disabled={saving}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase">Phase</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm"
                  disabled={saving}
                >
                  {(phaseOptions ?? [{ value: priority, label: labelForPriority(priority) }]).map((phase) => (
                    <option key={phase.value} value={phase.value}>
                      {phase.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" className="flex-1" onClick={handleSave} disabled={saving || !description.trim()}>
                  <Check className="h-4 w-4 mr-1" /> {t("common.save", "Save")}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="hover:bg-neutral-50/50 transition-colors border-b border-neutral-100 last:border-0">
      <td className="py-2.5 px-3 font-mono font-medium text-neutral-700 text-xs">
        {item.tooth_number ? (
          <span className="bg-neutral-100 px-1.5 py-0.5 rounded font-mono font-medium text-xs">
            #{item.tooth_number}
          </span>
        ) : "—"}
      </td>
      <td className="py-2.5 px-3 text-neutral-700">
        <BulletTextList text={item.description} />
      </td>
      <td className="py-2.5 px-3">
        <select
          value={item.priority ?? "phase_1"}
          onChange={(e) => {
            void onSave({
              description: item.description,
              estimatedPrice: Number(item.estimated_price),
              toothNumber: item.tooth_number,
              priority: e.target.value,
            })
          }}
          className="h-7 rounded border border-neutral-200 bg-neutral-50 px-1.5 text-xs text-neutral-600 focus:outline-none"
          disabled={saving}
        >
          {phaseOptions?.map((phase) => (
            <option key={phase.value} value={phase.value}>
              {phase.label}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2.5 px-3 text-right font-medium text-neutral-900">
        ₱{Number(item.estimated_price).toLocaleString()}
      </td>
      <td className="py-2.5 px-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8 hover:bg-neutral-100" onClick={beginEditing} disabled={saving}>
            <Pencil className="h-3.5 w-3.5" />
            <span className="sr-only">{t("treatmentPlan.editItem", "Edit")}</span>
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => void onDelete()}
            disabled={saving}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="sr-only">{t("treatmentPlan.deleteItem", "Remove")}</span>
          </Button>
        </div>
      </td>
    </tr>
  )
}
