"use client"

import * as React from "react"
import Link from "next/link"
import { Loader2, Search, User, UserCheck, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useLocale } from "@/hooks/use-locale"
import type { PatientRecord } from "@/lib/patients/patient-service"

type WalkInCheckInDialogProps = {
  open: boolean
  branchName?: string
  patientQuery: string
  onPatientQueryChange: (value: string) => void
  patients: PatientRecord[]
  selectedPatientId: string
  selectedPatientLabel: string
  onSelectPatient: (patient: PatientRecord) => void
  onClearPatient: () => void
  checkInNotes: string
  onCheckInNotesChange: (value: string) => void
  checkingIn: boolean
  billingOverridePending: boolean
  consentOverridePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onBillingOverride: () => void
  onConsentOverride: () => void
  onClose: () => void
}

export function WalkInCheckInDialog({
  open,
  branchName,
  patientQuery,
  onPatientQueryChange,
  patients,
  selectedPatientId,
  selectedPatientLabel,
  onSelectPatient,
  onClearPatient,
  checkInNotes,
  onCheckInNotesChange,
  checkingIn,
  billingOverridePending,
  consentOverridePending,
  onSubmit,
  onBillingOverride,
  onConsentOverride,
  onClose,
}: WalkInCheckInDialogProps) {
  const { t } = useLocale()
  const searchRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const timer = window.setTimeout(() => searchRef.current?.focus(), 50)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !checkingIn) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.clearTimeout(timer)
      document.body.style.overflow = prevOverflow
      window.removeEventListener("keydown", onKey)
    }
  }, [open, checkingIn, onClose])

  if (!open) return null

  const searching = patientQuery.length >= 2 && !selectedPatientId && patients.length === 0

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      onClick={() => {
        if (!checkingIn) onClose()
      }}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200 sm:rounded-xl sm:slide-in-from-bottom-0 sm:zoom-in-95"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="walk-in-check-in-title"
      >
        <div className="border-b border-neutral-100 px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                  <UserCheck className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <h2 id="walk-in-check-in-title" className="text-lg font-semibold text-neutral-900">
                    {t("queue.walkInTitle", "Walk-in check-in")}
                  </h2>
                  {branchName ? (
                    <p className="text-xs text-neutral-500">{branchName}</p>
                  ) : null}
                </div>
              </div>
              <p className="mt-2 text-sm text-neutral-600">
                {t(
                  "queue.walkInSubtitle",
                  "Find the patient, add an optional note, then check in to Waiting."
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={checkingIn}
              className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 disabled:opacity-50"
              aria-label={t("common.close", "Close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4 sm:px-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="walk-in-patient-search" className="text-sm font-medium text-neutral-800">
                {t("queue.walkInPatient", "Patient")}
              </label>
              {selectedPatientId ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-primary-200 bg-primary-50/60 px-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                      {selectedPatientLabel
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-neutral-900">{selectedPatientLabel}</p>
                      <p className="text-xs text-neutral-500">
                        {t("queue.walkInSelected", "Ready to check in")}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-neutral-600"
                    disabled={checkingIn}
                    onClick={onClearPatient}
                  >
                    {t("common.change", "Change")}
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                    aria-hidden
                  />
                  <Input
                    ref={searchRef}
                    id="walk-in-patient-search"
                    value={patientQuery}
                    onChange={(e) => onPatientQueryChange(e.target.value)}
                    placeholder={t("queue.walkInSearchPlaceholder", "Name or phone number…")}
                    className="h-11 pl-9"
                    autoComplete="off"
                  />
                  {patients.length > 0 ? (
                    <ul className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
                      {patients.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-neutral-50"
                            onClick={() => onSelectPatient(p)}
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-medium text-neutral-600">
                              <User className="h-3.5 w-3.5" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-neutral-900">
                                {p.first_name} {p.last_name}
                              </span>
                              {p.phone ? (
                                <span className="block text-xs text-neutral-500">{p.phone}</span>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {searching ? (
                    <p className="mt-2 text-xs text-neutral-500">
                      {t("queue.walkInNoResults", "No patients found — try another spelling or register a new patient.")}
                    </p>
                  ) : null}
                  {patientQuery.length > 0 && patientQuery.length < 2 ? (
                    <p className="mt-2 text-xs text-neutral-500">
                      {t("queue.walkInSearchHint", "Type at least 2 characters to search.")}
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="walk-in-note" className="text-sm font-medium text-neutral-800">
                {t("queue.walkInNote", "Visit note")}
                <span className="ml-1 font-normal text-neutral-400">
                  ({t("common.optional", "optional")})
                </span>
              </label>
              <textarea
                id="walk-in-note"
                value={checkInNotes}
                onChange={(e) => onCheckInNotesChange(e.target.value)}
                placeholder={t("queue.walkInNotePlaceholder", "e.g. tooth pain, cleaning, follow-up…")}
                rows={2}
                className="flex w-full resize-none rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {billingOverridePending ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-sm text-amber-950">
                <p>{t("billing.gateBlockCheckIn", "Outstanding billing must be collected or overridden.")}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 border-amber-300 bg-white"
                  disabled={checkingIn}
                  onClick={onBillingOverride}
                >
                  {t("billing.gateOverrideCheckIn", "Check in with billing override")}
                </Button>
              </div>
            ) : null}

            {consentOverridePending ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-sm text-amber-950">
                <p>{t("queue.consentGate", "Patient has unsigned consents. Override is logged in audit.")}</p>
                {selectedPatientId ? (
                  <Button variant="link" size="sm" className="mt-1 h-auto p-0 text-amber-900" asChild>
                    <Link href={`/patients/${selectedPatientId}?tab=consents`}>
                      {t("queue.openConsents", "Open consents")}
                    </Link>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 border-amber-300 bg-white"
                  disabled={checkingIn}
                  onClick={onConsentOverride}
                >
                  {t("queue.consentOverride", "Check in anyway")}
                </Button>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 border-t border-neutral-100 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={checkingIn} onClick={onClose} className="sm:min-w-[7rem]">
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              type="submit"
              disabled={checkingIn || !selectedPatientId}
              className="gap-2 sm:min-w-[10rem]"
            >
              {checkingIn ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  {t("queue.checkingIn", "Checking in…")}
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4" aria-hidden />
                  {t("queue.checkInToWaiting", "Check in to Waiting")}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
