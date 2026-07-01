"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BulletTextarea } from "@/components/ui/BulletTextarea"
import { useLocale } from "@/hooks/use-locale"
import { logOrthoAdjustment } from "@/lib/clinical/ortho-service"
import { toStoredBulletText } from "@/lib/text/bullet-text"

interface OrthoAdjustmentDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  caseId: string
  onCreated: (nextVisitDate?: string, bookNext?: boolean) => void
}

export function OrthoAdjustmentDrawer({
  open,
  onOpenChange,
  caseId,
  onCreated,
}: OrthoAdjustmentDrawerProps) {
  const { t } = useLocale()

  const [adjDate, setAdjDate] = React.useState("")
  const [procedure, setProcedure] = React.useState("")
  const [nextProcedure, setNextProcedure] = React.useState("")
  const [nextVisitDate, setNextVisitDate] = React.useState("")
  const [paymentAmount, setPaymentAmount] = React.useState("")
  const [adjNotes, setAdjNotes] = React.useState("")
  const [bookNextAfterSave, setBookNextAfterSave] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const resetForm = React.useCallback(() => {
    setAdjDate("")
    setProcedure("")
    setNextProcedure("")
    setNextVisitDate("")
    setPaymentAmount("")
    setAdjNotes("")
    setBookNextAfterSave(false)
    setSaving(false)
    setError(null)
  }, [])

  // Close on Escape
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onOpenChange])

  // Reset form when drawer closes
  React.useEffect(() => {
    if (!open) resetForm()
  }, [open, resetForm])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!caseId || !procedure.trim()) return
    setSaving(true)
    setError(null)

    const { error: err } = await logOrthoAdjustment({
      caseId,
      adjustmentDate: adjDate || new Date().toISOString().slice(0, 10),
      procedure: toStoredBulletText(procedure),
      nextProcedure: nextProcedure.trim() ? toStoredBulletText(nextProcedure) : undefined,
      nextVisitDate: nextVisitDate || undefined,
      paymentAmount: parseFloat(paymentAmount) || 0,
      notes: adjNotes.trim() || undefined,
    })

    setSaving(false)
    if (err) {
      setError(err)
    } else {
      onOpenChange(false)
      onCreated(nextVisitDate, bookNextAfterSave)
    }
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[250] flex justify-end">
      {/* Backdrop */}
      <button
        type="button"
        aria-label={t("common.close", "Close")}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Drawer panel */}
      <aside className="relative z-10 flex h-full w-full max-w-lg flex-col border-l bg-white shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">
              {t("ortho.logVisit", "Log adjustment visit")}
            </h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              {t("ortho.logVisitHint", "Record adjustment procedure, payment, and next planned appointment.")}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <form id="ortho-adjustment-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Visit Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600">
                {t("ortho.visitDate", "Visit date")} *
              </label>
              <Input
                type="date"
                required
                value={adjDate}
                onChange={(e) => setAdjDate(e.target.value)}
              />
            </div>

            {/* Current Procedure */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600">
                {t("ortho.procedurePerformed", "Procedure performed")} *
              </label>
              <BulletTextarea
                placeholder={t("ortho.procedurePerformed", "e.g. Upper arch wire change to 0.016 Niti...")}
                value={procedure}
                onChange={setProcedure}
              />
            </div>

            {/* Next Procedure */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600">
                {t("ortho.nextProcedurePlanned", "Next procedure planned")}
              </label>
              <BulletTextarea
                placeholder={t("ortho.nextProcedurePlaceholder", "e.g. Lower arch wire change, add power chain...")}
                value={nextProcedure}
                onChange={setNextProcedure}
              />
            </div>

            {/* Next Visit Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600">
                {t("ortho.nextVisitDate", "Next visit date")}
              </label>
              <Input
                type="date"
                value={nextVisitDate}
                onChange={(e) => setNextVisitDate(e.target.value)}
              />
            </div>

            {/* Payment Amount */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600">
                {t("ortho.visitPayment", "Payment at this visit (₱)")}
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>

            {/* General Visit Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600">
                {t("ortho.generalNotes", "General visit notes")}
              </label>
              <BulletTextarea
                placeholder={t("ortho.generalNotesPlaceholder", "e.g. Oral hygiene is fair, minor irritation on buccal mucosa...")}
                value={adjNotes}
                onChange={setAdjNotes}
              />
            </div>

            {/* Book Next Checkbox */}
            {nextVisitDate && (
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="bookNextAfterSave"
                  className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                  checked={bookNextAfterSave}
                  onChange={(e) => setBookNextAfterSave(e.target.checked)}
                />
                <label htmlFor="bookNextAfterSave" className="text-sm font-medium text-neutral-700">
                  {t("ortho.bookNextAfterSave", "Book this next appointment immediately on save")}
                </label>
              </div>
            )}

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="border-t bg-neutral-50/60 px-6 py-4">
          <div className="flex gap-3">
            <Button
              type="submit"
              form="ortho-adjustment-form"
              disabled={saving || !procedure.trim()}
              className="flex-1"
            >
              {saving
                ? t("common.saving", "Saving…")
                : t("ortho.logVisitButton", "Log visit")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel", "Cancel")}
            </Button>
          </div>
        </div>
      </aside>
    </div>,
    document.body
  )
}
