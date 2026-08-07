"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import {
  FileText,
  Receipt,
  Wallet,
  DoorClosed,
  X,
  Check,
  Loader2,
  AlertTriangle,
  ChevronRight,
} from "lucide-react"
import { useLocale } from "@/hooks/use-locale"
import { useBranch } from "@/hooks/use-branch"
import { usePermission } from "@/hooks/use-permission"
import { Button } from "@/components/ui/button"
import type { PatientBillingGate } from "@/lib/billing/invoice-service"
import { closePatientEncounter, fetchActiveEncounter } from "@/lib/clinical/encounter-service"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { notify } from "@/lib/ui/notify"
import { cn } from "@/lib/utils"

export type VisitCheckoutWizardProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientId: string
  patientName: string
  billingGate: PatientBillingGate | null
  encounterId?: string | null
}

type ChecklistTone = "ok" | "warning" | "neutral"

function ToneChip({ tone, label }: { tone: ChecklistTone; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tone === "ok" && "bg-emerald-50 text-emerald-700",
        tone === "warning" && "bg-amber-50 text-amber-700",
        tone === "neutral" && "bg-neutral-100 text-neutral-600"
      )}
    >
      {tone === "ok" ? <Check className="h-3 w-3" aria-hidden /> : null}
      {tone === "warning" ? <AlertTriangle className="h-3 w-3" aria-hidden /> : null}
      {label}
    </span>
  )
}

function ChecklistRow({
  icon: Icon,
  title,
  hint,
  tone,
  chipLabel,
  href,
  actionLabel,
  onNavigate,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  hint: string
  tone: ChecklistTone
  chipLabel: string
  href: string
  actionLabel: string
  onNavigate: () => void
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3">
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          tone === "ok" ? "bg-emerald-50 text-emerald-600" : tone === "warning" ? "bg-amber-50 text-amber-600" : "bg-neutral-100 text-neutral-500"
        )}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-neutral-900">{title}</p>
          <ToneChip tone={tone} label={chipLabel} />
        </div>
        <p className="mt-0.5 text-xs leading-5 text-neutral-500">{hint}</p>
        <Link
          href={href}
          onClick={onNavigate}
          className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800"
        >
          {actionLabel}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  )
}

export function VisitCheckoutWizard({
  open,
  onOpenChange,
  patientId,
  patientName,
  billingGate,
  encounterId: encounterIdProp,
}: VisitCheckoutWizardProps) {
  const { t } = useLocale()
  const { activeBranch } = useBranch()
  const { hasPermission, loading: permissionLoading } = usePermission()
  const canManageQueue =
    !permissionLoading && hasPermission(PERMISSIONS.QUEUE_MANAGE)
  const [closingEncounter, setClosingEncounter] = React.useState(false)
  const [encounterClosed, setEncounterClosed] = React.useState(false)
  const [encounterId, setEncounterId] = React.useState<string | null>(encounterIdProp ?? null)
  const [resolvingEncounter, setResolvingEncounter] = React.useState(false)
  const [resolveError, setResolveError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setEncounterClosed(false)
    setEncounterId(encounterIdProp ?? null)
    setResolveError(null)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open, encounterIdProp])

  React.useEffect(() => {
    if (!open || encounterIdProp || !activeBranch?.id) return
    let cancelled = false
    setResolvingEncounter(true)
    void fetchActiveEncounter(patientId, activeBranch.id).then(({ data, error }) => {
      if (cancelled) return
      setResolvingEncounter(false)
      if (error) {
        setResolveError(error)
        return
      }
      if (data?.encounter.id) {
        setEncounterId(data.encounter.id)
        return
      }
      setResolveError(
        t(
          "queue.checkoutNoOpenVisit",
          "No open visit found to close. Open Patient Visits if this was already finished."
        )
      )
    })
    return () => {
      cancelled = true
    }
  }, [open, encounterIdProp, activeBranch?.id, patientId, t])

  const handleCloseEncounter = async () => {
    if (!canManageQueue) {
      notify.error(
        t(
          "queue.queueManageDenied",
          "You need queue.manage permission to finish visits."
        )
      )
      return
    }
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

  const hasOpenInvoice = Boolean(billingGate?.primary_open_invoice_id)
  const hasBalance = (billingGate?.open_balance ?? 0) > 0
  const hasBillingGap = Boolean(billingGate?.has_billing_gap)

  const noteHref = `/patients/${patientId}/notes${encounterId ? `?encounter=${encounterId}` : ""}`
  const billingHref = billingGate?.primary_open_invoice_id
    ? `/billing/${billingGate.primary_open_invoice_id}`
    : `/patients/${patientId}/treatment-plan${encounterId ? `?encounter=${encounterId}` : ""}`
  const paymentHref = billingGate?.primary_open_invoice_id
    ? `/billing/${billingGate.primary_open_invoice_id}`
    : `/billing?patient=${patientId}`
  const encounterHref = `/patients/${patientId}/visits${encounterId ? `?encounter=${encounterId}` : ""}`

  const hasOutstanding = hasBillingGap || hasOpenInvoice || hasBalance
  const balanceLabel = hasBalance
    ? `₱${(billingGate?.open_balance ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
    : null

  const dismiss = () => onOpenChange(false)

  const modal = (
    <div
      className="fixed inset-0 z-[250] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-label={t("common.close", "Close")}
        onClick={dismiss}
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
                {t("queue.checkoutTitle", "Finish visit")}
              </h2>
              <p className="mt-0.5 text-sm text-neutral-500">
                {patientName} — {t("queue.visitComplete", "treatment done — close the visit")}
              </p>
            </div>
            <button
              type="button"
              onClick={dismiss}
              className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100"
              aria-label={t("common.close", "Close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-[140px] flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          <div className="rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-xs leading-5 text-amber-900">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>
                {t(
                  "queue.checkoutSoftGateHint",
                  "Soft gate: if notes, billing, or payment are not ready, finish urgent clinic work first and return here. Exceptions stay visible in closeout and audit."
                )}
              </p>
            </div>
          </div>

          <ChecklistRow
            icon={FileText}
            title={t("queue.checkoutStepNote", "Clinical note")}
            hint={t(
              "queue.notePrompt",
              "Add or sign the clinical note while the visit is fresh. If the patient must leave first, this remains visible as a missing note."
            )}
            tone="neutral"
            chipLabel={t("queue.checkoutChipReview", "Review")}
            href={noteHref}
            actionLabel={t("queue.createNote", "Create note")}
            onNavigate={dismiss}
          />

          <ChecklistRow
            icon={Receipt}
            title={t("queue.checkoutStepBilling", "Billing & plan")}
            hint={
              hasBillingGap
                ? t(
                    "queue.checkoutBillingGap",
                    "Review treatment plan or open invoice. You can continue, but closeout will still highlight the balance or missing invoice."
                  )
                : t("queue.checkoutBillingOk", "Review billing or treatment plan for this visit.")
            }
            tone={hasBillingGap ? "warning" : "ok"}
            chipLabel={
              hasBillingGap
                ? t("queue.checkoutChipAttention", "Needs attention")
                : t("queue.checkoutChipReady", "Ready")
            }
            href={billingHref}
            actionLabel={
              hasOpenInvoice
                ? t("queue.openInvoice", "Open invoice")
                : t("queue.completeBilling", "Complete billing")
            }
            onNavigate={dismiss}
          />

          <ChecklistRow
            icon={Wallet}
            title={t("queue.checkoutStepPayment", "Collect payment")}
            hint={
              hasOpenInvoice
                ? t("queue.checkoutPaymentDue", "Collect outstanding payment before the patient leaves.")
                : t(
                    "queue.checkoutPaymentClear",
                    "No open invoice found. Confirm billing is complete or create an invoice from the treatment plan."
                  )
            }
            tone={hasOpenInvoice ? "warning" : "ok"}
            chipLabel={
              hasOpenInvoice
                ? balanceLabel ?? t("queue.checkoutChipBalanceDue", "Balance due")
                : t("queue.checkoutChipClear", "Clear")
            }
            href={paymentHref}
            actionLabel={t("queue.collectPayment", "Collect payment")}
            onNavigate={dismiss}
          />

          {resolvingEncounter ? (
            <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50/70 px-3 py-3 text-sm text-neutral-600">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t("queue.checkoutResolvingVisit", "Finding today’s open visit…")}
            </div>
          ) : null}

          {!resolvingEncounter && resolveError && !encounterId ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-900">
              <p>{resolveError}</p>
              <Link
                href={encounterHref}
                onClick={dismiss}
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800"
              >
                {t("queue.viewEncounterRecord", "View visit record")}
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          ) : null}

          {encounterId ? (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                  <DoorClosed className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-neutral-900">
                    {t("queue.closeVisit", "Finish visit")}
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-neutral-500">
                    {t(
                      "queue.checkoutClosePrompt",
                      "This closes today’s visit. The patient leaves the open-visit list. If billing or notes are incomplete, leave it open and return from Queue or Patient Visits."
                    )}
                  </p>
                  {hasOutstanding ? (
                    <p className="mt-1 text-[11px] font-medium text-amber-700">
                      {t(
                        "queue.checkoutCloseSoftGate",
                        "Finishing with open items is allowed and logged in audit."
                      )}
                    </p>
                  ) : null}
                  {!permissionLoading && !canManageQueue ? (
                    <p className="mt-1 text-[11px] font-medium text-amber-700">
                      {t(
                        "queue.queueManageDenied",
                        "You need queue.manage permission to finish visits."
                      )}
                    </p>
                  ) : null}
                </div>
              </div>
              <Button
                className="mt-3 w-full gap-2"
                disabled={closingEncounter || encounterClosed || !canManageQueue}
                title={
                  canManageQueue
                    ? undefined
                    : t(
                        "queue.queueManageDeniedTooltip",
                        "You need queue.manage to finish this visit"
                      )
                }
                onClick={() => void handleCloseEncounter()}
              >
                {closingEncounter ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <DoorClosed className="h-4 w-4" />
                )}
                {t("queue.closeVisit", "Finish visit")}
              </Button>
              <Button className="mt-2 w-full gap-2" variant="ghost" size="sm" asChild>
                <Link href={encounterHref} onClick={dismiss}>
                  {t("queue.viewEncounterRecord", "View visit record")}
                </Link>
              </Button>
            </div>
          ) : null}
        </div>

        <div className="shrink-0 flex items-center justify-end gap-2 border-t border-neutral-200 bg-white px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:px-6">
          <Button type="button" variant="ghost" size="sm" onClick={dismiss}>
            {encounterId ? t("common.dismiss", "Dismiss") : t("queue.checkoutDone", "Done")}
          </Button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
