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
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  const dialog = open ? (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label={t("common.close", "Close")}
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-[201] w-full max-w-lg rounded-xl border border-neutral-200 bg-white shadow-xl animate-fade-rise max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
          <h2 className="text-base font-semibold">{t("waitlist.addFormTitle", "Add patient to waitlist")}</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <form onSubmit={onSubmit} className="grid gap-4 p-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-2">
            <label className="text-xs font-medium">{t("appointments.searchPatient", "Search patient")}</label>
            <Input
              placeholder={t("appointments.searchPatientPlaceholder", "Name or phone…")}
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
                      {p.phone ? ` · ${p.phone}` : ""}
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
              placeholder="Procedure or preference…"
            />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={saving || !selectedPatientId}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("common.saving", "Saving…")}
                </>
              ) : (
                t("waitlist.addPatient", "Add to waitlist")
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel", "Cancel")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  ) : null

  return mounted && dialog ? createPortal(dialog, document.body) : null
}
