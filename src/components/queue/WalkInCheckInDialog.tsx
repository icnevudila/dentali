"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { Loader2, Search, User, UserCheck, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useLocale } from "@/hooks/use-locale"
import type { PatientRecord } from "@/lib/patients/patient-service"
import { PatientCommandCenter } from "@/components/queue/PatientCommandCenter"

export type WalkInCheckInDialogProps = {
  open: boolean
  branchId?: string
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
  consentFormHref?: string | null
  consentFormLabel?: string | null
  onSubmit: (e: React.FormEvent) => void
  onBillingOverride: () => void
  onConsentOverride: () => void
  onClose: () => void
}

export function WalkInCheckInDialog({
  open,
  branchId,
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
  consentFormHref,
  consentFormLabel,
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

  if (!open || typeof document === "undefined") return null

  const searching = patientQuery.length >= 2 && !selectedPatientId && patients.length === 0
  const initials = selectedPatientLabel
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const modal = (
    <div
      className="fixed inset-0 z-[250] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-label={t("common.close", "Close")}
        disabled={checkingIn}
        onClick={() => {
          if (!checkingIn) onClose()
        }}
      />

      <div
        className="relative z-[251] flex max-h-[min(92vh,100dvh)] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] border border-neutral-200 bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200 sm:max-h-[min(90vh,720px)] sm:rounded-2xl sm:slide-in-from-bottom-0 sm:zoom-in-95"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="walk-in-check-in-title"
      >
        <div className="shrink-0 border-b border-neutral-200 bg-neutral-50 px-4 pb-3 pt-3 sm:px-5 sm:pb-4 sm:pt-4">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-neutral-300 sm:hidden" aria-hidden />
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                <UserCheck className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 id="walk-in-check-in-title" className="truncate text-base font-semibold text-neutral-900">
                  {t("queue.patientArrivalTitle", "Patient arrival")}
                </h2>
                {branchName ? (
                  <p className="truncate text-xs text-neutral-500">{branchName}</p>
                ) : null}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={onClose}
              disabled={checkingIn}
              aria-label={t("common.close", "Close")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
            <p className="text-sm leading-relaxed text-neutral-600">
              {t(
                "queue.patientArrivalSubtitle",
                "Find the patient, add an optional note, then check in to Waiting."
              )}
            </p>

            <div className="space-y-2">
              <label htmlFor="walk-in-patient-search" className="text-xs font-medium text-neutral-700">
                {t("queue.walkInPatient", "Patient")}
              </label>
              {selectedPatientId ? (
                <div className="flex items-center gap-2 rounded-xl border border-primary-200/80 bg-primary-50/40 px-3 py-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
                    {initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">{selectedPatientLabel}</p>
                    <p className="text-xs text-neutral-500">
                      {t("queue.walkInSelected", "Ready to check in")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 shrink-0 px-2 text-xs text-neutral-600"
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
                    <ul className="absolute z-[252] mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
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
                  {patientQuery.length > 0 && patientQuery.length < 2 ? (
                    <p className="mt-1.5 text-xs text-neutral-500">
                      {t("queue.walkInSearchHint", "Type at least 2 characters to search.")}
                    </p>
                  ) : null}
                  {searching ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-neutral-500">
                        {t(
                          "queue.walkInNoResults",
                          "No patients found — try another spelling or register a new patient."
                        )}
                      </p>
                      <Button asChild variant="link" size="sm" className="h-auto p-0 text-primary-700">
                        <Link href="/patients/new?returnTo=queue">
                          {t("queue.registerWalkInPatient", "Register new walk-in patient")}
                        </Link>
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
              {!selectedPatientId ? (
                <p className="text-xs leading-relaxed text-neutral-500">
                  {t(
                    "queue.patientArrivalHint",
                    "Use this for registered walk-ins or patients opened from a profile. If the patient has no file yet, register them first and return here."
                  )}
                </p>
              ) : null}
            </div>

            {selectedPatientId && branchId ? (
              <PatientCommandCenter patientId={selectedPatientId} branchId={branchId} className="p-3" />
            ) : null}

            <div className="space-y-2">
              <label htmlFor="walk-in-note" className="text-xs font-medium text-neutral-700">
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
                className="flex w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                    <Link
                      href={
                        consentFormHref ??
                        `/patients/${selectedPatientId}/consents/general-treatment`
                      }
                    >
                      {consentFormLabel ??
                        t("queue.openRequiredConsent", "Sign required consent")}
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

          <div className="shrink-0 border-t border-neutral-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-4">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={checkingIn}
                onClick={onClose}
                className="h-11 w-full sm:min-w-[7rem] sm:w-auto"
              >
                {t("common.cancel", "Cancel")}
              </Button>
              <Button
                type="submit"
                disabled={checkingIn || !selectedPatientId}
                className="h-11 w-full gap-2 sm:min-w-[12rem] sm:w-auto"
              >
                {checkingIn ? (
                  <>
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    <span>{t("queue.checkingIn", "Checking in…")}</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="h-4 w-4 shrink-0" aria-hidden />
                    <span>{t("queue.checkInToWaiting", "Check in to Waiting")}</span>
                  </>
                )}
              </Button>
            </div>
            {!selectedPatientId ? (
              <p className="mt-2 text-center text-xs text-neutral-500 sm:text-right">
                {t("queue.walkInSelectPatientHint", "Select a patient above to enable check-in.")}
              </p>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
