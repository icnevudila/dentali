"use client"

import * as React from "react"
import { Pencil, Undo2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BulletTextarea } from "@/components/ui/BulletTextarea"
import { BulletTextList } from "@/components/ui/BulletTextList"
import { toStoredBulletText } from "@/lib/text/bullet-text"
import type { OrthoAdjustment } from "@/lib/clinical/ortho-service"

export type OrthoAdjustmentPatch = {
  adjustmentDate: string
  procedure: string
  nextProcedure?: string
  nextVisitDate?: string
  paymentAmount: number
  notes?: string
}

export function OrthoAdjustmentRow({
  adjustment,
  canEdit,
  saving,
  colSpan,
  onUpdate,
  onRevert,
}: {
  adjustment: OrthoAdjustment
  canEdit: boolean
  saving: boolean
  colSpan: number
  onUpdate: (patch: OrthoAdjustmentPatch) => Promise<void>
  onRevert: () => Promise<void>
}) {
  const [editing, setEditing] = React.useState(false)
  const [adjDate, setAdjDate] = React.useState(adjustment.adjustment_date)
  const [procedure, setProcedure] = React.useState(adjustment.procedure)
  const [nextProcedure, setNextProcedure] = React.useState(adjustment.next_procedure ?? "")
  const [nextVisitDate, setNextVisitDate] = React.useState(adjustment.next_visit_date ?? "")
  const [paymentAmount, setPaymentAmount] = React.useState(
    adjustment.payment_amount > 0 ? String(adjustment.payment_amount) : ""
  )
  const [adjNotes, setAdjNotes] = React.useState(adjustment.notes ?? "")

  React.useEffect(() => {
    setAdjDate(adjustment.adjustment_date)
    setProcedure(adjustment.procedure)
    setNextProcedure(adjustment.next_procedure ?? "")
    setNextVisitDate(adjustment.next_visit_date ?? "")
    setPaymentAmount(adjustment.payment_amount > 0 ? String(adjustment.payment_amount) : "")
    setAdjNotes(adjustment.notes ?? "")
  }, [adjustment])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!procedure.trim()) return
    await onUpdate({
      adjustmentDate: adjDate || adjustment.adjustment_date,
      procedure: toStoredBulletText(procedure),
      nextProcedure: nextProcedure.trim() ? toStoredBulletText(nextProcedure) : undefined,
      nextVisitDate: nextVisitDate || undefined,
      paymentAmount: parseFloat(paymentAmount) || 0,
      notes: adjNotes.trim() || undefined,
    })
    setEditing(false)
  }

  if (editing) {
    return (
      <tr className="bg-primary-50/40">
        <td colSpan={colSpan} className="p-3">
          <form onSubmit={(e) => void handleSave(e)} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-600">Date</label>
              <Input type="date" value={adjDate} onChange={(e) => setAdjDate(e.target.value)} disabled={saving} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-600">Next visit date</label>
              <Input
                type="date"
                value={nextVisitDate}
                onChange={(e) => setNextVisitDate(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium text-neutral-600">Procedure *</label>
              <BulletTextarea value={procedure} onChange={setProcedure} rows={4} disabled={saving} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium text-neutral-600">Next procedure</label>
              <BulletTextarea value={nextProcedure} onChange={setNextProcedure} rows={3} disabled={saving} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-600">Payment (₱)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium text-neutral-600">Notes</label>
              <BulletTextarea value={adjNotes} onChange={setAdjNotes} rows={2} disabled={saving} />
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" size="sm" disabled={saving || !procedure.trim()}>
                {saving ? "Saving…" : "Save row"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td className="py-2 whitespace-nowrap">{adjustment.adjustment_date}</td>
      <td className="py-2 align-top max-w-xs">
        <BulletTextList text={adjustment.procedure} />
      </td>
      <td className="py-2 align-top text-neutral-600 max-w-xs">
        <BulletTextList text={adjustment.next_procedure} />
      </td>
      <td className="py-2 text-neutral-600">{adjustment.next_visit_date ?? "—"}</td>
      <td className="py-2 text-right">₱{Number(adjustment.payment_amount).toLocaleString()}</td>
      {canEdit ? (
        <td className="py-2 text-right">
          <div className="flex items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => setEditing(true)}
              disabled={saving}
              title="Edit this row"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-amber-700"
              onClick={() => void onRevert()}
              disabled={saving}
              title="Return / undo this row"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Return
            </Button>
          </div>
        </td>
      ) : null}
    </tr>
  )
}
