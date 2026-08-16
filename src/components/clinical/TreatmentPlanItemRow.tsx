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
import {
  centavosToInputValue,
  centavosToPesoMajor,
  parseMoneyToCentavos,
  pesoMajorToCentavos,
} from "@/lib/money/php-money"

function itemStatusLabel(
  status: string,
  t: (key: string, fallback: string) => string
) {
  if (status === "completed") return t("treatmentPlan.itemCompleted", "Completed")
  if (status === "in_progress") return t("treatmentPlan.itemInProgress", "In progress")
  if (status === "cancelled") return t("treatmentPlan.itemCancelled", "Cancelled")
  return t("treatmentPlan.itemPlanned", "Planned")
}

import { cn } from "@/lib/utils"

export function TreatmentPlanItemRow({
  item,
  editable,
  saving,
  phaseOptions,
  phaseLabel,
  onSave,
  onDelete,
  onMarkStatus,
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
  onMarkStatus?: (status: "planned" | "in_progress" | "completed" | "cancelled") => Promise<void>
}) {
  const { t } = useLocale()
  const [editing, setEditing] = React.useState(false)
  const [description, setDescription] = React.useState(item.description)
  const [price, setPrice] = React.useState(
    centavosToInputValue(pesoMajorToCentavos(Number(item.estimated_price || 0)))
  )
  const [tooth, setTooth] = React.useState(item.tooth_number ?? "")
  const [priority, setPriority] = React.useState(item.priority ?? "phase_1")
  const [formError, setFormError] = React.useState<string | null>(null)

  const beginEditing = () => {
    setDescription(item.description)
    setPrice(centavosToInputValue(pesoMajorToCentavos(Number(item.estimated_price || 0))))
    setTooth(item.tooth_number ?? "")
    setPriority(item.priority ?? "phase_1")
    setFormError(null)
    setEditing(true)
  }

  const handleSave = async () => {
    const priceCentavos = parseMoneyToCentavos(price)
    if (priceCentavos === null || priceCentavos < 0) {
      setFormError(
        t(
          "billing.invalidMoneyAmount",
          "Enter a valid amount in PHP (up to 2 decimal places)."
        )
      )
      return
    }
    setFormError(null)
    await onSave({
      description: toStoredBulletText(description.trim()),
      estimatedPrice: centavosToPesoMajor(priceCentavos),
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
        <td className="py-2.5 px-3">
          {onMarkStatus ? (
            <select
              value={item.status || "planned"}
              disabled={saving}
              onChange={(e) => void onMarkStatus(e.target.value as "planned" | "in_progress" | "completed" | "cancelled")}
              className={cn(
                "h-7 rounded border text-xs font-medium px-2 py-0.5 transition-colors focus:outline-none cursor-pointer",
                item.status === "completed" && "bg-emerald-50 text-emerald-700 border-emerald-300",
                item.status === "in_progress" && "bg-amber-50 text-amber-700 border-amber-300",
                item.status === "cancelled" && "bg-rose-50 text-rose-700 border-rose-300",
                (!item.status || item.status === "planned") && "bg-neutral-50 text-neutral-700 border-neutral-300"
              )}
            >
              <option value="planned">⚪ Planned</option>
              <option value="in_progress">🟡 Ongoing (In Progress)</option>
              <option value="completed">🟢 Done (Completed)</option>
              <option value="cancelled">🔴 Cancelled</option>
            </select>
          ) : (
            <span className="text-xs text-neutral-600">{itemStatusLabel(item.status, t)}</span>
          )}
        </td>
        <td className="py-2.5 px-3 text-right font-medium text-neutral-900">
          ₱{Number(item.estimated_price || 0).toLocaleString("en-PH")}
        </td>
        <td className="py-2.5 px-3 text-right">
          {onMarkStatus && (
            <div className="flex justify-end gap-1">
              {item.status === "planned" && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs px-2"
                  disabled={saving}
                  onClick={() => void onMarkStatus("in_progress")}
                >
                  {t("treatmentPlan.markInProgress", "Start")}
                </Button>
              )}
              {item.status === "in_progress" && (
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={saving}
                  onClick={() => void onMarkStatus("completed")}
                >
                  {t("treatmentPlan.markCompleted", "Mark done")}
                </Button>
              )}
              {item.status === "completed" && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs px-2 text-neutral-500"
                  disabled={saving}
                  onClick={() => void onMarkStatus("in_progress")}
                >
                  {t("treatmentPlan.reopenItem", "Reopen")}
                </Button>
              )}
              {item.status === "cancelled" && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs px-2 text-neutral-500"
                  disabled={saving}
                  onClick={() => void onMarkStatus("planned")}
                >
                  Restore
                </Button>
              )}
            </div>
          )}
        </td>
      </tr>
    )
  }

  if (editing) {
    return (
      <tr className="bg-primary-50/20">
        <td colSpan={6} className="p-3">
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
                  type="text"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder={t("treatmentPlan.patientPrice", "Price (₱)")}
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
            {formError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            ) : null}
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
      <td className="py-2.5 px-3 text-xs text-neutral-600">
        {itemStatusLabel(item.status, t)}
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
