"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ExternalLink, MessageCircle, RefreshCw, Wallet } from "lucide-react"
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
  collectionsReminderHref,
  countOverdueCollectionsRows,
  fetchCollectionsArWorklist,
  filterCollectionsRows,
  formatCollectionsPhp,
  sumCollectionsBalance,
  type CollectionsAgingBucket,
  type CollectionsArWorklist,
  type CollectionsDraftRow,
  type CollectionsReminderChannel,
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

function formatClinicDateTime(iso: string, locale: string): string {
  if (!iso) return "—"
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleString(locale === "fil" ? "fil-PH" : locale === "tr" ? "tr-TR" : "en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function moneyLocale(locale: string): string {
  return locale === "fil" ? "fil-PH" : locale === "tr" ? "tr-TR" : "en-PH"
}

/**
 * AR chase / collections worklist.
 * Open issued balances (sent/partial) aged Asia/Manila — drafts with balance
 * appear in a separate “not yet issued” bucket (not overdue AR).
 * Reminder CTA deep-links to invoice WhatsApp reminder UI (no fake SMS vendor).
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

  const reminderChannelLabel = (channel: CollectionsReminderChannel) => {
    const map: Record<CollectionsReminderChannel, string> = {
      whatsapp: t("billing.collectionsChannelWhatsapp", "WhatsApp"),
      sms: t("billing.collectionsChannelSms", "SMS"),
      email: t("billing.collectionsChannelEmail", "Email"),
    }
    return map[channel]
  }

  const allRows = list?.rows ?? []
  const overdueCount = countOverdueCollectionsRows(allRows)
  const rows = filterCollectionsRows(allRows, focusOverdue ? "overdue" : "all")
  const draftRows = focusOverdue ? [] : (list?.draft_rows ?? [])
  const outstanding = sumCollectionsBalance(rows)
  const draftOutstanding = sumCollectionsBalance(draftRows)
  const ml = moneyLocale(locale)
  const hasIssuedView = rows.length > 0
  const hasDraftView = draftRows.length > 0
  const showEmpty =
    !hasIssuedView && !(list?.has_draft_balance && !focusOverdue && (list?.draft_rows.length ?? 0) > 0)

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
                <Badge variant="danger" className="font-normal tabular-nums">
                  {t("billing.collectionsFilterOverdueCount", "Overdue only · {count}").replace(
                    "{count}",
                    String(overdueCount)
                  )}
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
          ) : showEmpty && !hasDraftView ? (
            <EmptyState
              icon={Wallet}
              title={
                focusOverdue
                  ? t("billing.collectionsEmptyOverdueTitle", "No overdue invoices")
                  : list?.has_open_ar || list?.has_draft_balance
                    ? t("billing.collectionsEmptyTitle", "No open balances in this view")
                    : t("billing.collectionsNoDataTitle", "No open AR yet")
              }
              description={
                focusOverdue
                  ? (list?.draft_rows.length ?? 0) > 0
                    ? t(
                        "billing.collectionsEmptyOverdueWithDrafts",
                        "Nothing is past due right now. Draft invoices with a balance are not overdue — clear the filter to review issued AR and drafts."
                      )
                    : t(
                        "billing.collectionsEmptyOverdueDescription",
                        "Nothing is past due right now. Clear the overdue filter to see all open balances, or review invoices."
                      )
                  : list?.has_open_ar || list?.has_draft_balance
                    ? t(
                        "billing.collectionsEmptyDescription",
                        "Open balances and aging follow-ups will appear here. Until then, review finance reports or open invoices."
                      )
                    : t(
                        "billing.collectionsNoDataDescription",
                        "Issued invoices with an unpaid balance (sent or partial) show up here once they exist for this branch. Drafts with a balance appear separately as not yet issued."
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
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-600">
                <p>
                  {focusOverdue
                    ? t("billing.collectionsOverdueCount", "{count} overdue")
                        .replace("{count}", String(rows.length))
                    : t("billing.collectionsOpenCount", "{count} open").replace(
                        "{count}",
                        String(rows.length)
                      )}
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

              <div className="flex flex-wrap items-center gap-2 text-sm">
                {focusOverdue ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/billing/collections">
                      {t("billing.collectionsShowAll", "Show all open balances")}
                    </Link>
                  </Button>
                ) : overdueCount > 0 ? (
                  <Button variant="default" size="sm" asChild>
                    <Link href="/billing/collections?focus=overdue">
                      {t("billing.collectionsFilterOverdueCount", "Overdue only · {count}").replace(
                        "{count}",
                        String(overdueCount)
                      )}
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled type="button">
                    {t("billing.collectionsFilterOverdueCount", "Overdue only · {count}").replace(
                      "{count}",
                      "0"
                    )}
                  </Button>
                )}
                {focusOverdue && (list?.draft_rows.length ?? 0) > 0 ? (
                  <p className="text-xs text-neutral-500">
                    {t(
                      "billing.collectionsDraftsHiddenOverdue",
                      "Draft invoices are hidden in overdue view — they are not yet issued."
                    )}
                  </p>
                ) : null}
              </div>

              {hasIssuedView ? (
                <section className="space-y-3" aria-labelledby="collections-issued-heading">
                  <h2
                    id="collections-issued-heading"
                    className="text-sm font-semibold text-neutral-900"
                  >
                    {t("billing.collectionsIssuedSection", "Issued open balances")}
                  </h2>
                  <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
                    {rows.map((row) => {
                      const name = collectionsPatientDisplayName(row)
                      const invoiceHref = `/billing/${row.invoice_id}`
                      const reminderHref = collectionsReminderHref(row.invoice_id)
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
                                  {t(
                                    "billing.collectionsDaysOutstanding",
                                    "{days}d outstanding"
                                  ).replace("{days}", String(row.days_outstanding))}
                                </span>
                              ) : null}
                              {row.last_reminder_at ? (
                                <span className="tabular-nums">
                                  {t(
                                    "billing.collectionsLastReminderAt",
                                    "Last reminder: {datetime}"
                                  ).replace(
                                    "{datetime}",
                                    formatClinicDateTime(row.last_reminder_at, locale)
                                  )}
                                  {row.last_reminder_channel
                                    ? ` · ${reminderChannelLabel(row.last_reminder_channel)}`
                                    : null}
                                </span>
                              ) : (
                                <span>
                                  {t(
                                    "billing.collectionsLastReminderNone",
                                    "No reminder logged"
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button asChild size="sm" variant="outline" className="gap-1.5">
                              <Link href={reminderHref}>
                                <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                                {t("billing.collectionsSendReminder", "Send reminder")}
                              </Link>
                            </Button>
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
                </section>
              ) : focusOverdue ? (
                <EmptyState
                  icon={Wallet}
                  title={t("billing.collectionsEmptyOverdueTitle", "No overdue invoices")}
                  description={t(
                    "billing.collectionsEmptyOverdueDescription",
                    "Nothing is past due right now. Clear the overdue filter to see all open balances, or review invoices."
                  )}
                  action={
                    <Button asChild size="sm">
                      <Link href="/billing/collections">
                        {t("billing.collectionsShowAll", "Show all open balances")}
                      </Link>
                    </Button>
                  }
                />
              ) : null}

              {hasDraftView ? (
                <DraftSection
                  rows={draftRows}
                  outstanding={draftOutstanding}
                  locale={locale}
                  ml={ml}
                  t={t}
                />
              ) : null}
            </div>
          )}
        </ModulePageShell>
      </DirectionalTransition>
    </PermissionGate>
  )
}

function DraftSection({
  rows,
  outstanding,
  locale,
  ml,
  t,
}: {
  rows: CollectionsDraftRow[]
  outstanding: number
  locale: string
  ml: string
  t: (key: string, fallback: string) => string
}) {
  return (
    <section className="space-y-3" aria-labelledby="collections-drafts-heading">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="collections-drafts-heading" className="text-sm font-semibold text-neutral-900">
            {t("billing.collectionsDraftsSection", "Not yet issued (drafts)")}
          </h2>
          <Badge variant="outline" className="font-normal tabular-nums">
            {rows.length} · {formatCollectionsPhp(outstanding, ml)}
          </Badge>
        </div>
        <p className="text-xs text-neutral-500">
          {t(
            "billing.collectionsDraftsHint",
            "Draft invoices with a balance are not accounts receivable until issued. Issue them before chasing payment — reminders apply to issued invoices only."
          )}
        </p>
      </div>
      <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-dashed border-neutral-300 bg-neutral-50/60">
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
                    {t("billing.collectionsDraftBadge", "Draft · not issued")}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
                  <Link href={`/patients/${row.patient_id}`} className="hover:underline">
                    {name}
                  </Link>
                  <span className="tabular-nums font-medium text-neutral-800">
                    {formatCollectionsPhp(row.balance, ml)}
                  </span>
                  <span>
                    {t("billing.collectionsCreated", "Created")}:{" "}
                    {formatClinicDate(row.created_date, locale)}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild size="sm" className="gap-1.5">
                  <Link href={invoiceHref}>
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    {t("billing.collectionsOpenDraft", "Open draft")}
                  </Link>
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
