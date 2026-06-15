"use client"

import Link from "next/link"
import { AlertTriangle, Receipt, Wallet, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/use-locale"
import type { PatientBillingGate } from "@/lib/billing/invoice-service"
import { backfillPatientPlanInvoices } from "@/lib/billing/invoice-service"
import * as React from "react"
import { toast } from "sonner"

export function PatientBillingGateBanner({
  gate,
  patientId,
  branchId,
  onDismiss,
  onBackfill,
}: {
  gate: PatientBillingGate
  patientId: string
  branchId?: string | null
  onDismiss?: () => void
  onBackfill?: () => void
}) {
  const { t } = useLocale()
  const [backfilling, setBackfilling] = React.useState(false)

  if (!gate.has_billing_gap) return null

  const missingPlans = gate.approved_plans_missing_invoice
  const invoiceHref = gate.primary_open_invoice_id
    ? `/billing/${gate.primary_open_invoice_id}`
    : `/billing?patient=${patientId}`

  const handleBackfill = async () => {
    setBackfilling(true)
    const { data, error } = await backfillPatientPlanInvoices({
      patientId,
      branchId: branchId ?? undefined,
    })
    setBackfilling(false)
    if (error) toast.error(error)
    else if (data) {
      toast.success(
        t("billing.gateBackfillDone", "Created {count} draft invoice(s).").replace(
          "{count}",
          String(data.created)
        )
      )
      onBackfill?.()
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 animate-fade-rise">
      <div className="flex gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-semibold">
            {t("billing.gateTitle", "Billing action required before checkout")}
          </p>

          {missingPlans.length > 0 ? (
            <ul className="list-disc pl-4 text-amber-900/90 space-y-0.5">
              {missingPlans.map((plan) => (
                <li key={plan.plan_id}>
                  {t(
                    "billing.gateMissingInvoice",
                    "Approved plan “{title}” has no invoice — create one from the plan."
                  ).replace("{title}", plan.title)}
                </li>
              ))}
            </ul>
          ) : null}

          {gate.open_balance > 0 ? (
            <p className="text-amber-900/90">
              {t("billing.gateOpenBalance", "Outstanding balance:")}{" "}
              <span className="font-semibold tabular-nums">
                ₱{gate.open_balance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
              </span>
              {gate.ortho_open_balance > 0 ? (
                <span className="text-amber-800/80">
                  {" "}
                  ({t("billing.gateOrthoPortion", "includes ortho")} ₱
                  {gate.ortho_open_balance.toLocaleString("en-PH")})
                </span>
              ) : null}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            {gate.primary_open_invoice_id ? (
              <Button size="sm" className="gap-1.5" asChild>
                <Link href={invoiceHref}>
                  <Receipt className="h-3.5 w-3.5" />
                  {t("billing.gateCollectPayment", "Collect payment")}
                </Link>
              </Button>
            ) : null}
            {missingPlans.length > 0 ? (
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5"
                disabled={backfilling}
                onClick={() => void handleBackfill()}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${backfilling ? "animate-spin" : ""}`} />
                {t("billing.gateBackfill", "Create missing invoices")}
              </Button>
            ) : null}
            {missingPlans.length > 0 ? (
              <Button size="sm" variant="outline" className="gap-1.5" asChild>
                <Link href={`/patients/${patientId}/treatment-plan?plan=${missingPlans[0].plan_id}`}>
                  <Wallet className="h-3.5 w-3.5" />
                  {t("billing.gateOpenPlan", "Open treatment plan")}
                </Link>
              </Button>
            ) : (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/billing?patient=${patientId}`}>
                  {t("billing.gateBillingList", "View invoices")}
                </Link>
              </Button>
            )}
            {onDismiss ? (
              <Button size="sm" variant="ghost" onClick={onDismiss}>
                {t("common.dismiss", "Dismiss")}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
