"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import {
  FileText,
  Receipt,
  Wallet,
  DoorClosed,
  ChevronRight,
  ChevronLeft,
  X,
  Check,
  Loader2,
  AlertTriangle,
} from "lucide-react"
import { useLocale } from "@/hooks/use-locale"
import { Button } from "@/components/ui/button"
import type { PatientBillingGate } from "@/lib/billing/invoice-service"
import { closePatientEncounter } from "@/lib/clinical/encounter-service"
import { notify } from "@/lib/ui/notify"
import { cn } from "@/lib/utils"

const STEPS = [
  { id: 1, icon: FileText, labelKey: "queue.checkoutStepNote", fallback: "Clinical note" },
  { id: 2, icon: Receipt, labelKey: "queue.checkoutStepBilling", fallback: "Billing & plan" },
  { id: 3, icon: Wallet, labelKey: "queue.checkoutStepPayment", fallback: "Collect payment" },
  { id: 4, icon: DoorClosed, labelKey: "queue.checkoutStepClose", fallback: "Checkout / Discharge" },
] as const

export type VisitCheckoutWizardProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientId: string
  patientName: string
  billingGate: PatientBillingGate | null
  encounterId?: string | null
}

export function VisitCheckoutWizard({
  open,
  onOpenChange,
  patientId,
  patientName,
  billingGate,
  encounterId,
}: VisitCheckoutWizardProps) {
  const { t } = useLocale()
  const [step, setStep] = React.useState(1)
  const [closingEncounter, setClosingEncounter] = React.useState(false)
  const [encounterClosed, setEncounterClosed] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => {
      setStep(1)
      setEncounterClosed(false)
    }, 0)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.clearTimeout(id)
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  const maxStep = encounterId ? 4 : 3
  const visibleSteps = encounterId ? STEPS : STEPS.slice(0, 3)

  const handleCloseEncounter = async () => {
    if (!encounterId || closingEncounter) return
    setClosingEncounter(true)
    const { error } = await closePatientEncounter(encounterId)
    setClosingEncounter(false)
    if (error) {
      notify.error(error)
      return
    }
    setEncounterClosed(true)
    notify.success(t("queue.encounterClosed", "Visit closed"))
    onOpenChange(false)
  }

  if (!open || typeof document === "undefined") return null

  const noteHref = `/patients/${patientId}/notes${encounterId ? `?encounter=${encounterId}` : ""}`
  const billingHref = billingGate?.primary_open_invoice_id
    ? `/billing/${billingGate.primary_open_invoice_id}`
    : `/patients/${patientId}/treatment-plan${encounterId ? `?encounter=${encounterId}` : ""}`
  const paymentHref = billingGate?.primary_open_invoice_id
    ? `/billing/${billingGate.primary_open_invoice_id}`
    : `/billing?patient=${patientId}`
  const encounterHref = `/patients/${patientId}/visits${encounterId ? `?encounter=${encounterId}` : ""}`

  const modal = (
    <div
      className="fixed inset-0 z-[250] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-label={t("common.close", "Close")}
        onClick={() => onOpenChange(false)}
      />
      <div
        className="relative z-[251] flex max-h-[min(92vh,100dvh)] w-full max-w-md flex-col overflow-hidden rounded-t-[30px] border border-neutral-200 bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200 sm:max-h-[min(90vh,720px)] sm:rounded-2xl sm:slide-in-from-bottom-0 sm:zoom-in-95"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="visit-checkout-title"
      >
        <div className="shrink-0 border-b border-neutral-200 bg-neutral-50 px-5 pb-4 pt-3 sm:px-6 sm:pt-5">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-neutral-300 sm:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="visit-checkout-title" className="text-lg font-semibold text-neutral-900">
                {t("queue.checkoutTitle", "Patient checkout")}
              </h2>
              <p className="mt-0.5 text-sm text-neutral-500">
                {patientName} — {t("queue.visitComplete", "treatment done — close the visit")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100"
              aria-label={t("common.close", "Close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-1 px-5 pt-4 sm:px-6">
          {visibleSteps.map((s, i) => {
            const Icon = s.icon
            const active = step === s.id
            const done = step > s.id || (s.id === 4 && encounterClosed)
            return (
              <React.Fragment key={s.id}>
                <div
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1 text-center",
                    active ? "text-primary-700" : done ? "text-emerald-600" : "text-neutral-400"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
                      active && "border-primary-300 bg-primary-50",
                      done && "border-emerald-300 bg-emerald-50",
                      !active && !done && "border-neutral-200 bg-neutral-50"
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </span>
                  <span className="text-[10px] font-medium leading-tight">
                    {t(s.labelKey, s.fallback)}
                  </span>
                </div>
                {i < visibleSteps.length - 1 ? (
                  <div className={cn("h-0.5 w-4 shrink-0", done ? "bg-emerald-300" : "bg-neutral-200")} />
                ) : null}
              </React.Fragment>
            )
          })}
        </div>

        <div className="min-h-[140px] flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          <div className="rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-xs leading-5 text-amber-900">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p className="sm:hidden">
                {t("queue.checkoutSoftGateShort", "Missing items stay in closeout; continue if needed.")}
              </p>
              <p className="hidden sm:block">
                {t(
                  "queue.checkoutSoftGateHint",
                  "Soft gate: if notes, billing, or payment are not ready, finish urgent clinic work first and return here. Exceptions stay visible in closeout and audit."
                )}
              </p>
            </div>
          </div>

          {step === 1 ? (
            <>
              <p className="text-sm text-neutral-600">
                {t(
                  "queue.notePrompt",
                  "Add or sign the clinical note while the visit is fresh. If the patient must leave first, this remains visible as a missing note."
                )}
              </p>
              <Button className="w-full gap-2" asChild>
                <Link href={noteHref} onClick={() => onOpenChange(false)}>
                  <FileText className="h-4 w-4" />
                  {t("queue.createNote", "Create note")}
                </Link>
              </Button>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <p className="text-sm text-neutral-600">
                {billingGate?.has_billing_gap
                  ? t(
                      "queue.checkoutBillingGap",
                      "Review treatment plan or open invoice. You can continue, but closeout will still highlight the balance or missing invoice."
                    )
                  : t("queue.checkoutBillingOk", "Review billing or treatment plan for this visit.")}
              </p>
              <Button className="w-full gap-2" variant="outline" asChild>
                <Link href={billingHref} onClick={() => onOpenChange(false)}>
                  <Receipt className="h-4 w-4" />
                  {billingGate?.primary_open_invoice_id
                    ? t("queue.openInvoice", "Open invoice")
                    : t("queue.completeBilling", "Complete billing")}
                </Link>
              </Button>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <p className="text-sm text-neutral-600">
                {billingGate?.primary_open_invoice_id
                  ? t("queue.checkoutPaymentDue", "Collect outstanding payment before the patient leaves.")
                  : t(
                      "queue.checkoutPaymentClear",
                      "No open invoice found. Confirm billing is complete or create an invoice from the treatment plan."
                    )}
              </p>
              {billingGate?.primary_open_invoice_id ? (
                <Button className="w-full gap-2" asChild>
                  <Link href={paymentHref} onClick={() => onOpenChange(false)}>
                    <Wallet className="h-4 w-4" />
                    {t("queue.collectPayment", "Collect payment")}
                  </Link>
                </Button>
              ) : (
                <Button
                  className="w-full gap-2"
                  variant="outline"
                  onClick={() => {
                    if (encounterId) setStep(4)
                    else onOpenChange(false)
                  }}
                >
                  <Check className="h-4 w-4" />
                  {encounterId ? t("common.next", "Next") : t("queue.checkoutDone", "Done")}
                </Button>
              )}
            </>
          ) : null}

          {step === 4 && encounterId ? (
            <>
              <p className="text-sm text-neutral-600">
                {t(
                  "queue.checkoutClosePrompt",
                  "This closes today’s visit (discharge). The patient leaves the open-visit list. If billing or notes are incomplete, leave it open and return from Queue or Patient Visits."
                )}
              </p>
              <Button
                className="w-full gap-2"
                disabled={closingEncounter || encounterClosed}
                onClick={() => void handleCloseEncounter()}
              >
                {closingEncounter ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <DoorClosed className="h-4 w-4" />
                )}
                {t("queue.closeVisit", "Checkout / Discharge")}
              </Button>
              <Button className="w-full gap-2" variant="ghost" size="sm" asChild>
                <Link href={encounterHref} onClick={() => onOpenChange(false)}>
                  {t("queue.viewEncounterRecord", "View visit record")}
                </Link>
              </Button>
            </>
          ) : null}
        </div>

        <div className="shrink-0 flex items-center justify-between gap-2 border-t border-neutral-200 bg-white px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:px-6">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={step <= 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("common.back", "Back")}
          </Button>
          {step < maxStep ? (
            <Button type="button" size="sm" onClick={() => setStep((s) => s + 1)} className="gap-1">
              {t("common.next", "Next")}
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {t("common.dismiss", "Dismiss")}
            </Button>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
