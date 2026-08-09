"use client"

import * as React from "react"
import Link from "next/link"
import { HandCoins, RefreshCw } from "lucide-react"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { DirectionalTransition } from "@/components/layout/DirectionalTransition"
import {
  commissionInvoiceLabel,
  formatCommissionPhp,
  listProviderCommissions,
  sumCommissionAmounts,
  type CommissionLedgerRow,
} from "@/lib/billing/commission-ledger-service"

function moneyLocale(locale: string): string {
  return locale === "fil" ? "fil-PH" : locale === "tr" ? "tr-TR" : "en-PH"
}

function formatManilaDateTime(iso: string, locale: string): string {
  if (!iso) return "—"
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleString(locale === "fil" ? "fil-PH" : locale === "tr" ? "tr-TR" : "en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Read-only provider commission ledger for the active branch.
 * Rows are written by record_invoice_payment / webhook RPCs (SECURITY DEFINER).
 */
export default function BillingCommissionsPage() {
  const { t, locale } = useLocale()
  const { activeBranch } = useBranch()
  const [rows, setRows] = React.useState<CommissionLedgerRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(() => {
    if (!activeBranch) {
      setRows([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    void listProviderCommissions(activeBranch.id).then(({ data, error: err }) => {
      setRows(data)
      setError(err)
      setLoading(false)
    })
  }, [activeBranch])

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      load()
    }, 0)
    return () => window.clearTimeout(id)
  }, [load])

  const ml = moneyLocale(locale)
  const total = sumCommissionAmounts(rows)

  return (
    <PermissionGate permission={PERMISSIONS.BILLING_READ}>
      <DirectionalTransition>
        <ModulePageShell
          eyebrow={t("billing.commissionsEyebrow", "Finance")}
          icon={HandCoins}
          title={t("billing.commissionsTitle", "Commission ledger")}
          description={t(
            "billing.commissionsDescription",
            "Provider commissions logged when payments are recorded for this branch."
          )}
          panel={false}
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => load()}
              disabled={!activeBranch || loading}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              {t("common.refresh", "Refresh")}
            </Button>
          }
        >
          {!activeBranch ? (
            <p className="text-sm text-neutral-500">
              {t("dashboard.selectBranch", "Select a branch to view stats")}
            </p>
          ) : loading ? (
            <PageLoadingSkeleton variant="listRows" />
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50/80 p-4">
              <p className="text-sm font-medium text-red-800">
                {t("billing.commissionsErrorTitle", "Could not load commission ledger")}
              </p>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => load()}>
                {t("common.retry", "Retry")}
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={HandCoins}
              title={t("billing.commissionsEmptyTitle", "No commissions logged yet")}
              description={t(
                "billing.commissionsEmptyDescription",
                "When a payment is recorded for a provider with a commission rate, the amount appears here."
              )}
              action={
                <Button asChild size="sm">
                  <Link href="/billing">{t("billing.commissionsOpenInvoices", "Open invoices")}</Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-600">
                <p>
                  {t("billing.commissionsCount", "{count} entries")
                    .replace("{count}", String(rows.length))}
                </p>
                <p className="tabular-nums font-medium text-neutral-900">
                  {t("billing.commissionsTotal", "Total")} · {formatCommissionPhp(total, ml)}
                </p>
              </div>

              <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">
                        {t("billing.commissionsColDate", "Logged")}
                      </th>
                      <th className="px-4 py-3 font-medium">
                        {t("billing.commissionsColProvider", "Provider")}
                      </th>
                      <th className="px-4 py-3 font-medium">
                        {t("billing.commissionsColInvoice", "Invoice")}
                      </th>
                      <th className="px-4 py-3 font-medium text-right">
                        {t("billing.commissionsColAmount", "Amount")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-b border-neutral-100 last:border-0">
                        <td className="px-4 py-3 text-neutral-600 tabular-nums">
                          {formatManilaDateTime(row.calculated_at, locale)}
                        </td>
                        <td className="px-4 py-3 font-medium text-neutral-900">
                          {row.provider_name}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/billing/${row.invoice_id}`}
                            className="text-teal-700 underline-offset-2 hover:underline"
                          >
                            {commissionInvoiceLabel(row)}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-neutral-900">
                          {formatCommissionPhp(row.amount, ml)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </ModulePageShell>
      </DirectionalTransition>
    </PermissionGate>
  )
}
