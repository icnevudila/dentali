"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useLocale } from "@/hooks/use-locale"
import type { WaitlistUrgency } from "@/lib/waitlist/waitlist-service"

interface PatientOption {
  id: string
  first_name: string
  last_name: string
  phone?: string | null
}

interface WaitlistAddDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  saving: boolean
  patientQuery: string
  onPatientQueryChange: (value: string) => void
  patients: PatientOption[]
  selectedPatientId: string
  onSelectPatient: (patient: PatientOption) => void
  urgency: WaitlistUrgency
  onUrgencyChange: (urgency: WaitlistUrgency) => void
  preferredDate: string
  onPreferredDateChange: (value: string) => void
  timeStart: string
  onTimeStartChange: (value: string) => void
  timeEnd: string
  onTimeEndChange: (value: string) => void
  notes: string
  onNotesChange: (value: string) => void
  onSubmit: (e: React.FormEvent) => void
}

export function WaitlistAddDialog({
  open,
  onOpenChange,
  saving,
  patientQuery,
  onPatientQueryChange,
  patients,
  selectedPatientId,
  onSelectPatient,
  urgency,
  onUrgencyChange,
  preferredDate,
  onPreferredDateChange,
  timeStart,
  onTimeStartChange,
  timeEnd,
  onTimeEndChange,
  notes,
  onNotesChange,
  onSubmit,
}: WaitlistAddDialogProps) {
  const { t } = useLocale()
  React.useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  const dialog = open ? (
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label={t("common.close", "Close")}
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-[201] flex max-h-[min(92vh,100dvh)] w-full max-w-lg flex-col overflow-hidden rounded-t-[30px] border border-neutral-200 bg-white shadow-xl animate-fade-rise sm:max-h-[90vh] sm:rounded-2xl"
      >
        <div className="shrink-0 border-b border-neutral-200 bg-neutral-50 px-5 pb-4 pt-3 sm:px-6 sm:pt-5">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-neutral-300 sm:hidden" />
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">{t("waitlist.addFormTitle", "Add patient to waitlist")}</h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <form onSubmit={onSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="grid flex-1 gap-4 overflow-y-auto overscroll-contain px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:grid-cols-2 sm:px-6 sm:py-5">
            <div className="sm:col-span-2 space-y-2">
              <label className="text-xs font-medium">{t("appointments.searchPatient", "Search patient")}</label>
              <Input
                placeholder={t("appointments.searchPatientPlaceholder", "Name or phone...")}
                value={patientQuery}
                onChange={(e) => onPatientQueryChange(e.target.value)}
              />
              {patients.length > 0 ? (
                <ul className="max-h-40 overflow-y-auto divide-y rounded-md border">
                  {patients.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 ${selectedPatientId === p.id ? "bg-primary-50" : ""}`}
                        onClick={() => onSelectPatient(p)}
                      >
                        {p.first_name} {p.last_name}
                        {p.phone ? ` - ${p.phone}` : ""}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t("waitlist.urgency", "Urgency")}</label>
              <select
                className="h-9 w-full rounded-md border border-neutral-200 px-3 text-sm"
                value={urgency}
                onChange={(e) => onUrgencyChange(e.target.value as WaitlistUrgency)}
              >
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t("waitlist.preferredDate", "Preferred date")}</label>
              <Input type="date" value={preferredDate} onChange={(e) => onPreferredDateChange(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t("waitlist.timeFrom", "Time from")}</label>
              <Input type="time" value={timeStart} onChange={(e) => onTimeStartChange(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t("waitlist.timeTo", "Time to")}</label>
              <Input type="time" value={timeEnd} onChange={(e) => onTimeEndChange(e.target.value)} />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-medium">{t("waitlist.notes", "Notes")}</label>
              <Input
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                placeholder="Procedure or preference..."
              />
            </div>
          </div>
          <div className="shrink-0 border-t border-neutral-200 bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:px-6">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="h-11 w-full sm:w-auto" type="submit" disabled={saving || !selectedPatientId}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("common.saving", "Saving...")}
                  </>
                ) : (
                  t("waitlist.addPatient", "Add to waitlist")
                )}
              </Button>
              <Button className="h-11 w-full sm:w-auto" type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.cancel", "Cancel")}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  ) : null

  return typeof document !== "undefined" && dialog ? createPortal(dialog, document.body) : null
}
