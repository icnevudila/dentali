"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ExternalLink, RefreshCw, Wallet } from "lucide-react"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DirectionalTransition } from "@/components/layout/DirectionalTransition"
import {
  collectionsInvoiceLabel,
  collectionsPatientDisplayName,
  fetchCollectionsArWorklist,
  filterCollectionsRows,
  formatCollectionsPhp,
  sumCollectionsBalance,
  type CollectionsAgingBucket,
  type CollectionsArWorklist,
} from "@/lib/billing/collections-service"

function formatClinicDate(isoDate: string, locale: string): string {
  if (!isoDate) return "—"
  const parsed = new Date(`${isoDate}T12:00:00+08:00`)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return parsed.toLocaleDateString(locale === "fil" ? "fil-PH" : locale === "tr" ? "tr-TR" : "en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function moneyLocale(locale: string): string {
  return locale === "fil" ? "fil-PH" : locale === "tr" ? "tr-TR" : "en-PH"
}

/**
 * AR chase / collections worklist.
 * Open issued balances (sent/partial) aged Asia/Manila — no invented AR rows.
 */
export default function BillingCollectionsPage() {
  const { t, locale } = useLocale()
  const { activeBranch } = useBranch()
  const searchParams = useSearchParams()
  const focusOverdue = searchParams.get("focus") === "overdue"
  const [list, setList] = React.useState<CollectionsArWorklist | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(() => {
    if (!activeBranch) {
      setList(null)
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    void fetchCollectionsArWorklist(activeBranch.id).then(({ data, error: err }) => {
      setList(data)
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

  const bucketLabel = (bucket: CollectionsAgingBucket) => {
    const map: Record<CollectionsAgingBucket, string> = {
      "0_30": t("billing.collectionsBucket0_30", "0–30 days"),
      "31_60": t("billing.collectionsBucket31_60", "31–60 days"),
      "60_plus": t("billing.collectionsBucket60Plus", "60+ days"),
    }
    return map[bucket]
  }

  const allRows = list?.rows ?? []
  const rows = filterCollectionsRows(allRows, focusOverdue ? "overdue" : "all")
  const outstanding = sumCollectionsBalance(rows)
  const ml = moneyLocale(locale)

  return (
    <PermissionGate permission={PERMISSIONS.BILLING_READ}>
      <DirectionalTransition>
        <ModulePageShell
          eyebrow={t("billing.collectionsEyebrow", "Finance")}
          icon={Wallet}
          title={t("billing.collectionsTitle", "Collections")}
          description={t(
            "billing.collectionsDescription",
            "Accounts-receivable chase worklist — aging, reminders, and settlement follow-ups in one place."
          )}
          panel={false}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {focusOverdue ? (
                <Badge variant="danger" className="font-normal">
                  {t("billing.collectionsFilterOverdue", "Overdue only")}
                </Badge>
              ) : null}
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
              <Button asChild variant="outline" size="sm">
                <Link href="/reports?focus=billing#finance">
                  {t("billing.collectionsOpenReports", "Open finance reports")}
                </Link>
              </Button>
            </div>
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
                {t("billing.collectionsErrorTitle", "Could not load collections worklist")}
              </p>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => load()}>
                {t("common.retry", "Retry")}
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title={
                focusOverdue
                  ? t("billing.collectionsEmptyOverdueTitle", "No overdue invoices")
                  : list?.has_open_ar
                    ? t("billing.collectionsEmptyTitle", "No open balances in this view")
                    : t("billing.collectionsNoDataTitle", "No open AR yet")
              }
              description={
                focusOverdue
                  ? t(
                      "billing.collectionsEmptyOverdueDescription",
                      "Nothing is past due right now. Clear the overdue filter to see all open balances, or review invoices."
                    )
                  : list?.has_open_ar
                    ? t(
                        "billing.collectionsEmptyDescription",
                        "Open balances and aging follow-ups will appear here. Until then, review finance reports or open invoices."
                      )
                    : t(
                        "billing.collectionsNoDataDescription",
                        "Issued invoices with an unpaid balance (sent or partial) show up here once they exist for this branch."
                      )
              }
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {focusOverdue ? (
                    <Button asChild size="sm">
                      <Link href="/billing/collections">
                        {t("billing.collectionsShowAll", "Show all open balances")}
                      </Link>
                    </Button>
                  ) : null}
                  <Button asChild size="sm" variant={focusOverdue ? "outline" : "default"}>
                    <Link href="/billing">{t("billing.collectionsOpenInvoices", "Open invoices")}</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/reports?focus=billing#finance">
                      {t("billing.collectionsOpenReports", "Open finance reports")}
                    </Link>
                  </Button>
                </div>
              }
            />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-600">
                <p>
                  {t("billing.collectionsOpenCount", "{count} open")
                    .replace("{count}", String(rows.length))}
                  {` · ${formatCollectionsPhp(outstanding, ml)} ${t("billing.collectionsOutstanding", "outstanding")}`}
                  {list?.as_of_date
                    ? ` · ${t("billing.collectionsAsOf", "As of {date}").replace(
                        "{date}",
                        formatClinicDate(list.as_of_date, locale)
                      )}`
                    : null}
                </p>
                <p className="text-neutral-500">
                  {t(
                    "billing.collectionsAgingHint",
                    "Aging from due date (or issue date), Asia/Manila."
                  )}
                </p>
              </div>

              {list && list.bucket_totals.length > 0 && !focusOverdue ? (
                <ul className="flex flex-wrap gap-2">
                  {list.bucket_totals.map((bucket) => (
                    <li key={bucket.bucket}>
                      <Badge variant="outline" className="gap-1.5 tabular-nums font-normal">
                        <span>{bucketLabel(bucket.bucket)}</span>
                        <span className="text-neutral-500">
                          {bucket.count} · {formatCollectionsPhp(bucket.balance, ml)}
                        </span>
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : null}

              {focusOverdue ? (
                <div className="flex items-center gap-2 text-sm">
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/billing/collections">
                      {t("billing.collectionsShowAll", "Show all open balances")}
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/billing/collections?focus=overdue">
                      {t("billing.collectionsFilterOverdue", "Overdue only")}
                    </Link>
                  </Button>
                </div>
              )}

              <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
                {rows.map((row) => {
                  const name = collectionsPatientDisplayName(row)
                  const invoiceHref = `/billing/${row.invoice_id}`
                  return (
                    <li
                      key={row.invoice_id}
                      className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={invoiceHref}
                            className="truncate text-sm font-medium text-neutral-900 hover:underline"
                          >
                            {collectionsInvoiceLabel(row)}
                          </Link>
                          <Badge variant="outline" className="font-normal">
                            {bucketLabel(row.aging_bucket)}
                          </Badge>
                          {row.is_overdue ? (
                            <Badge variant="danger" className="font-normal">
                              {t("billing.collectionsOverdue", "Overdue")}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
                          <Link
                            href={`/patients/${row.patient_id}`}
                            className="hover:underline"
                          >
                            {name}
                          </Link>
                          <span className="tabular-nums font-medium text-neutral-800">
                            {formatCollectionsPhp(row.balance, ml)}
                          </span>
                          <span>
                            {t("billing.dueDate", "Due date")}:{" "}
                            {row.due_date ? formatClinicDate(row.due_date, locale) : "—"}
                          </span>
                          <span>
                            {t("billing.collectionsIssued", "Issued")}:{" "}
                            {formatClinicDate(row.issued_date, locale)}
                          </span>
                          {row.days_outstanding > 0 ? (
                            <span className="tabular-nums">
                              {t("billing.collectionsDaysOutstanding", "{days}d outstanding").replace(
                                "{days}",
                                String(row.days_outstanding)
                              )}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button asChild size="sm" className="gap-1.5">
                          <Link href={invoiceHref}>
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                            {t("billing.collectionsOpenInvoice", "Open invoice")}
                          </Link>
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </ModulePageShell>
      </DirectionalTransition>
    </PermissionGate>
  )
}
