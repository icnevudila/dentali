"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { FileText, Receipt, Wallet, ChevronRight, ChevronLeft, X, Check } from "lucide-react"
import { useLocale } from "@/hooks/use-locale"
import { Button } from "@/components/ui/button"
import type { PatientBillingGate } from "@/lib/billing/invoice-service"
import { cn } from "@/lib/utils"

const STEPS = [
  { id: 1, icon: FileText, labelKey: "queue.checkoutStepNote", fallback: "Clinical note" },
  { id: 2, icon: Receipt, labelKey: "queue.checkoutStepBilling", fallback: "Billing & plan" },
  { id: 3, icon: Wallet, labelKey: "queue.checkoutStepPayment", fallback: "Collect payment" },
] as const

export type VisitCheckoutWizardProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientId: string
  patientName: string
  billingGate: PatientBillingGate | null
}

export function VisitCheckoutWizard({
  open,
  onOpenChange,
  patientId,
  patientName,
  billingGate,
}: VisitCheckoutWizardProps) {
  const { t } = useLocale()
  const [mounted, setMounted] = React.useState(false)
  const [step, setStep] = React.useState(1)

  React.useEffect(() => setMounted(true), [])

  React.useEffect(() => {
    if (!open) return
    setStep(1)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  if (!open || !mounted) return null

  const noteHref = `/patients/${patientId}?tab=clinical-notes`
  const billingHref = billingGate?.primary_open_invoice_id
    ? `/billing/${billingGate.primary_open_invoice_id}`
    : `/patients/${patientId}/treatment-plan`
  const paymentHref = billingGate?.primary_open_invoice_id
    ? `/billing/${billingGate.primary_open_invoice_id}`
    : `/patients/${patientId}?tab=record`

  const modal = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="visit-checkout-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-6 py-4">
          <div>
            <h2 id="visit-checkout-title" className="text-lg font-semibold text-neutral-900">
              {t("queue.checkoutTitle", "Visit checkout")}
            </h2>
            <p className="text-sm text-neutral-500 mt-0.5">
              {patientName} — {t("queue.visitComplete", "visit marked complete")}
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

        <div className="flex items-center gap-1 px-6 pt-4">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const active = step === s.id
            const done = step > s.id
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
                {i < STEPS.length - 1 ? (
                  <div className={cn("h-0.5 w-4 shrink-0", done ? "bg-emerald-300" : "bg-neutral-200")} />
                ) : null}
              </React.Fragment>
            )
          })}
        </div>

        <div className="px-6 py-5 space-y-4 min-h-[140px]">
          {step === 1 ? (
            <>
              <p className="text-sm text-neutral-600">
                {t("queue.notePrompt", "Add a clinical note while the visit is fresh.")}
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
                  ? t("queue.checkoutBillingGap", "Complete treatment plan or open invoice before checkout.")
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
                  : t("queue.checkoutPaymentClear", "No open invoice — confirm billing is complete.")}
              </p>
              {billingGate?.primary_open_invoice_id ? (
                <Button className="w-full gap-2" asChild>
                  <Link href={paymentHref} onClick={() => onOpenChange(false)}>
                    <Wallet className="h-4 w-4" />
                    {t("queue.collectPayment", "Collect payment")}
                  </Link>
                </Button>
              ) : (
                <Button className="w-full gap-2" variant="outline" onClick={() => onOpenChange(false)}>
                  <Check className="h-4 w-4" />
                  {t("queue.checkoutDone", "Done")}
                </Button>
              )}
            </>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-neutral-100 px-6 py-4">
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
          {step < 3 ? (
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
