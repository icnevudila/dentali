"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Download, Printer, RefreshCw, Save, Wallet, CheckCircle2, XCircle, FileWarning, Receipt, PackageX, Lock, Unlock } from "lucide-react"
import { printCurrentPage } from "@/lib/utils/print"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { MetricStrip } from "@/components/layout/MetricStrip"
import type { MetricItem } from "@/components/layout/MetricStrip"
import { ClinicDayBar } from "@/components/layout/ClinicDayBar"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { useBranch } from "@/hooks/use-branch"
import { useClinicDay } from "@/hooks/use-clinic-day"
import { useLocale } from "@/hooks/use-locale"
import { parseDateKey } from "@/lib/appointments/week-calendar"
import {
  fetchCloseoutHistory,
  fetchDailyCloseout,
  finalizeCloseoutDay,
  reopenTodayCloseoutDay,
  saveCloseoutSnapshot,
  type CloseoutSnapshot,
  type DailyCloseout,
} from "@/lib/analytics/analytics-service"
import { PageErrorNotifier } from "@/components/ui/PageErrorNotifier"
import { Button } from "@/components/ui/button"
import { CompareBar } from "@/components/charts/ChartKit"
import { CloseoutPrintDocument } from "@/components/reports/CloseoutPrintDocument"
import { WorkflowSettingsLink } from "@/components/layout/WorkflowSettingsLink"
import { Badge } from "@/components/ui/badge"
import { notify } from "@/lib/ui/notify"
import { cn } from "@/lib/utils"

function formatDayLabel(dateKey: string) {
  return parseDateKey(dateKey).toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  })
}

function deltaLabel(current: number, previous: number) {
  const diff = current - previous
  if (diff === 0) return "—"
  const sign = diff > 0 ? "+" : ""
  return `${sign}${diff.toLocaleString()}`
}

function DailyCloseoutContent() {
  const { activeBranch } = useBranch()
  const { t } = useLocale()
  const { clinicDay, previousDay, isToday, formattedDay } = useClinicDay()
  const [data, setData] = useState<DailyCloseout | null>(null)
  const [previousData, setPreviousData] = useState<DailyCloseout | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<CloseoutSnapshot[]>([])
  const [savingSnapshot, setSavingSnapshot] = useState(false)
  const [finalizingDay, setFinalizingDay] = useState(false)
  const [reopeningDay, setReopeningDay] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    const branchId = activeBranch?.id ?? null
    const [closeout, prevCloseout, hist] = await Promise.all([
      fetchDailyCloseout(branchId, clinicDay),
      fetchDailyCloseout(branchId, previousDay),
      fetchCloseoutHistory(branchId, 10),
    ])
    setData(closeout.data)
    setPreviousData(prevCloseout.data)
    setHistory(hist.data)
    setError(closeout.error ?? prevCloseout.error ?? hist.error)
    setLoading(false)
  }, [activeBranch?.id, clinicDay, previousDay])

  useEffect(() => {
    const id = window.setTimeout(() => {
      void reload()
    }, 0)
    return () => window.clearTimeout(id)
  }, [reload])

  const dayLabel = isToday
    ? t("closeout.today", "today")
    : formattedDay

  const metrics: MetricItem[] = data
    ? [
        {
          label: isToday
            ? t("closeout.collected", "Collected today")
            : t("closeout.collectedDay", "Collected"),
          value: loading ? "—" : `₱${data.collected.toLocaleString()}`,
          hint: t("reports.metricCollectedOpen", "Open billing ledger"),
          icon: Wallet,
          variant: data.collected > 0 ? "success" : "default",
          href: "/billing",
        },
        {
          label: t("closeout.openBalance", "Open balance"),
          value: loading ? "—" : `₱${data.openBalance.toLocaleString()}`,
          hint: t("closeout.openBalanceHint", "View open invoices"),
          icon: Receipt,
          variant: data.openBalance > 0 ? "warning" : "default",
          href: "/billing?focus=open",
        },
        {
          label: t("closeout.completed", "Completed visits"),
          value: loading ? "—" : data.appointmentsCompleted,
          hint: t("reports.metricCompletedOpen", "View completed visits"),
          icon: CheckCircle2,
          variant: data.appointmentsCompleted > 0 ? "success" : "default",
          href: "/appointments",
        },
        {
          label: t("closeout.noShow", "No-shows"),
          value: loading ? "—" : data.noShow,
          hint: t("reports.metricNoShowOpen", "Review appointments"),
          icon: XCircle,
          variant: data.noShow > 0 ? "warning" : "default",
          href: "/appointments",
        },
        {
          label: t("closeout.pendingConsents", "Pending consents"),
          value: loading ? "—" : data.pendingConsents,
          hint: t("dashboard.pendingConsentsHint", "Awaiting patient signature"),
          icon: FileWarning,
          variant: data.pendingConsents > 0 ? "warning" : "default",
          href: "/patients?attention=consents",
        },
        {
          label: t("closeout.hmoPending", "HMO pending"),
          value: loading ? "—" : data.hmoPending,
          hint: t("closeout.hmoPendingHint", "Open HMO claims"),
          icon: PackageX,
          variant: data.hmoPending > 0 ? "warning" : "default",
          href: "/billing/hmo",
        },
      ]
    : []

  const chartData = data
    ? [
        {
          label: t("closeout.collected", "Collected today").slice(0, 11),
          value: data.collected,
        },
        { label: t("closeout.openBalance", "Open balance").slice(0, 11), value: data.openBalance },
        {
          label: t("closeout.completed", "Completed visits").slice(0, 11),
          value: data.appointmentsCompleted,
        },
        { label: t("closeout.noShow", "No-shows").slice(0, 11), value: data.noShow },
        {
          label: t("closeout.pendingConsents", "Pending consents").slice(0, 11),
          value: data.pendingConsents,
        },
        { label: t("closeout.hmoPending", "HMO pending").slice(0, 11), value: data.hmoPending },
      ]
    : []

  const compareRows = useMemo(() => {
    if (!data || !previousData) return []
    return [
      {
        label: t("closeout.collected", "Collected"),
        previous: previousData.collected,
        current: data.collected,
        format: (v: number) => `₱${v.toLocaleString()}`,
      },
      {
        label: t("closeout.completed", "Completed visits"),
        previous: previousData.appointmentsCompleted,
        current: data.appointmentsCompleted,
        format: (v: number) => String(v),
      },
      {
        label: t("closeout.noShow", "No-shows"),
        previous: previousData.noShow,
        current: data.noShow,
        format: (v: number) => String(v),
      },
      {
        label: t("closeout.pendingConsents", "Pending consents"),
        previous: previousData.pendingConsents,
        current: data.pendingConsents,
        format: (v: number) => String(v),
      },
    ]
  }, [data, previousData, t])

  const todaySnapshot = useMemo(
    () => history.find((snap) => snap.snapshot_date === clinicDay),
    [history, clinicDay]
  )

  const snapshotSavedForDay = Boolean(todaySnapshot)
  const dayFinalized = todaySnapshot?.finalized === true

  const handleSaveSnapshot = async () => {
    if (!isToday) return
    setSavingSnapshot(true)
    const { error: err, updated } = await saveCloseoutSnapshot(
      activeBranch?.id ?? null,
      clinicDay
    )
    setSavingSnapshot(false)
    if (err) {
      setError(err)
      notify.error(err)
    } else {
      notify.success(
        updated
          ? t("closeout.snapshotUpdated", "Closeout snapshot updated for today")
          : t("closeout.snapshotSaved", "Closeout snapshot saved for today")
      )
      void reload()
    }
  }

  const handleFinalizeDay = async () => {
    if (!isToday || dayFinalized) return
    const confirmation = window.prompt(
      t(
        "closeout.finalizeConfirm",
        "Type FINALIZE to lock billing edits for today's clinic day."
      )
    )
    if (confirmation !== "FINALIZE") {
      notify.error(t("closeout.finalizeCancelled", "Closeout was not finalized"))
      return
    }
    setFinalizingDay(true)
    const { error: err } = await finalizeCloseoutDay(activeBranch?.id ?? null, clinicDay)
    setFinalizingDay(false)
    if (err) {
      setError(err)
      notify.error(err)
    } else {
      notify.success(t("closeout.finalized", "Clinic day finalized — billing is locked for today"))
      void reload()
    }
  }

  const handleReopenDay = async () => {
    if (!isToday || !dayFinalized) return
    const confirmation = window.prompt(
      t(
        "closeout.reopenConfirm",
        "Type REOPEN to unlock today's billing edits and return the closeout to draft."
      )
    )
    if (confirmation !== "REOPEN") {
      notify.error(t("closeout.reopenCancelled", "Closeout remains finalized"))
      return
    }
    setReopeningDay(true)
    const { error: err } = await reopenTodayCloseoutDay(activeBranch?.id ?? null, clinicDay)
    setReopeningDay(false)
    if (err) {
      setError(err)
      notify.error(err)
    } else {
      notify.success(t("closeout.reopened", "Clinic day reopened — billing edits are unlocked"))
      void reload()
    }
  }

  const handlePrint = () => {
    printCurrentPage({ title: `Closeout Report — ${data?.date ?? ""}` })
  }

  const handleExport = () => {
    if (!data) return
    const rows = [
      ["Metric", "Value"],
      ["Date", data.date],
      ["Collected", data.collected],
      ["Open balance", data.openBalance],
      ["Open invoices", data.openInvoiceCount],
      ["Completed", data.appointmentsCompleted],
      ["No-show", data.noShow],
      ["Pending consents", data.pendingConsents],
      ["HMO pending", data.hmoPending],
      ["Low stock", data.lowStock],
    ]
    const csv = rows.map((r) => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `closeout-${data.date}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const printMetrics = metrics.map((m) => ({
    label: m.label,
    value: String(m.value),
  }))

  return (
    <>
      {data ? (
        <CloseoutPrintDocument
          clinicName="DentQL"
          branchName={activeBranch?.name ?? null}
          reportDate={data.date}
          previousDate={previousDay}
          title={t("closeout.title", "Daily closeout")}
          subtitle={t("closeout.subtitle", "Review collections, open balances, and exceptions before closing the day.")}
          metrics={printMetrics}
          data={data}
          previousData={previousData}
          compareRows={compareRows}
          history={history}
          snapshotTitle={
            isToday ? t("closeout.snapshot", "Today snapshot") : t("closeout.daySnapshot", "Day snapshot")
          }
          historyTitle={t("closeout.history", "Saved snapshots")}
          snapshotSaved={isToday ? snapshotSavedForDay : undefined}
        />
      ) : null}

      <ModulePageShell
        icon={Wallet}
        eyebrow={t("closeout.eyebrow", "Owner · End of day")}
        title={t("closeout.title", "Daily closeout")}
        description={t("closeout.subtitle", "Review collections, open balances, and exceptions before closing the day.")}
        actions={
          <div className="flex flex-wrap gap-2">
            <WorkflowSettingsLink />
            <Button variant="outline" size="sm" asChild>
              <Link href="/reports">
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                {t("closeout.backReports", "Reports")}
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              {t("common.refresh", "Refresh")}
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={!data}>
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              {t("closeout.printPdf", "Print / PDF")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleSaveSnapshot()}
              disabled={!data || savingSnapshot || !isToday || dayFinalized}
              title={
                dayFinalized
                  ? t("closeout.dayLockedHint", "This day is finalized — billing is locked")
                  : !isToday
                    ? t("closeout.snapshotTodayOnly", "Snapshots can only be saved for today")
                    : snapshotSavedForDay
                      ? t("closeout.snapshotResaveHint", "Updates today's draft closeout record")
                      : undefined
              }
            >
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {snapshotSavedForDay
                ? t("closeout.updateSnapshot", "Update draft snapshot")
                : t("closeout.saveSnapshot", "Save draft snapshot")}
            </Button>
            <Button
              size="sm"
              variant={dayFinalized ? "outline" : "default"}
              onClick={() => void handleFinalizeDay()}
              disabled={!data || finalizingDay || !isToday || dayFinalized}
              title={
                dayFinalized
                  ? t("closeout.alreadyFinalized", "Day already finalized")
                  : t("closeout.finalizeHint", "Run at end of shift to lock billing for this day")
              }
            >
              <Lock className="mr-1.5 h-3.5 w-3.5" />
              {dayFinalized
                ? t("closeout.dayFinalized", "Day finalized")
                : t("closeout.finalizeDay", "Finalize day & lock billing")}
            </Button>
            {isToday && dayFinalized ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleReopenDay()}
                disabled={!data || reopeningDay}
                title={t("closeout.reopenHint", "Admin-only undo for an accidental same-day closeout")}
              >
                <Unlock className="mr-1.5 h-3.5 w-3.5" />
                {reopeningDay
                  ? t("closeout.reopening", "Reopening…")
                  : t("closeout.reopenToday", "Reopen today")}
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={handleExport} disabled={!data}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {t("closeout.exportCsv", "Export CSV")}
            </Button>
          </div>
        }
      >
        <PageErrorNotifier error={error} onRetry={reload} />
        {error ? null : (
          <div className="space-y-6">
            <ClinicDayBar
              compareHint={t(
                "closeout.dayCompareHint",
                "Comparing {day} with the previous clinic day ({prev})."
              )
                .replace("{day}", dayLabel)
                .replace("{prev}", formatDayLabel(previousDay))}
            />

            <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/60 px-4 py-3 text-sm text-neutral-600">
              <p className="font-medium text-neutral-800">
                {t("closeout.howItWorksTitle", "How this report works")}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  {t(
                    "closeout.howItWorksLive",
                    "Numbers refresh from billing, appointments, queue, and inventory — they change during the day."
                  )}
                </li>
                <li>
                  {t(
                    "closeout.howItWorksSnapshot",
                    "Save draft snapshot anytime for audit — it does not lock billing. Finalize at end of shift to lock invoice edits for the day."
                  )}
                </li>
                <li>
                  {t(
                    "closeout.howItWorksCompare",
                    "Day-over-day table compares the selected clinic day with the previous Manila calendar day."
                  )}
                </li>
              </ul>
              {isToday && dayFinalized ? (
                <Badge variant="success" className="mt-3 font-normal">
                  {t("closeout.dayLockedBadge", "Billing locked for today")}
                </Badge>
              ) : isToday && snapshotSavedForDay ? (
                <Badge variant="outline" className="mt-3 font-normal">
                  {t("closeout.draftOnFile", "Draft snapshot on file — not locked")}
                </Badge>
              ) : null}
            </div>

            <MetricStrip items={metrics} className="lg:grid-cols-3" />
            <p className="text-sm text-neutral-500">
              {isToday
                ? dayFinalized
                  ? t(
                      "closeout.finalizedHint",
                      "This clinic day is finalized. Invoice and payment edits are locked; admins can reopen today's closeout if it was finalized by mistake."
                    )
                  : t(
                      "closeout.snapshotHint",
                      "Save a draft anytime. Use Finalize at end of shift to lock billing for the day."
                    )
                : t(
                    "closeout.pastDayHint",
                    "Viewing closeout for a past clinic day. Use Today to close the current shift."
                  )}
            </p>

            {compareRows.length > 0 ? (
              <div className="rounded-xl border border-neutral-200/80 bg-white p-4">
                <h3 className="mb-3 text-sm font-semibold text-neutral-900">
                  {t("closeout.vsPreviousDay", "Vs previous day")}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-neutral-500">
                        <th className="pb-2 font-medium">{t("closeout.metric", "Metric")}</th>
                        <th className="pb-2 font-medium">{formatDayLabel(previousDay)}</th>
                        <th className="pb-2 font-medium">
                          {isToday ? t("clinicDay.today", "Today") : formatDayLabel(clinicDay)}
                        </th>
                        <th className="pb-2 font-medium">{t("closeout.change", "Change")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {compareRows.map((row) => {
                        const diff = row.current - row.previous
                        return (
                          <tr key={row.label}>
                            <td className="py-2 font-medium text-neutral-800">{row.label}</td>
                            <td className="py-2 tabular-nums text-neutral-600">{row.format(row.previous)}</td>
                            <td className="py-2 tabular-nums text-neutral-900">{row.format(row.current)}</td>
                            <td
                              className={cn(
                                "py-2 tabular-nums font-medium",
                                diff > 0 && "text-emerald-700",
                                diff < 0 && "text-amber-700",
                                diff === 0 && "text-neutral-400"
                              )}
                            >
                              {row.label === t("closeout.collected", "Collected")
                                ? diff === 0
                                  ? "—"
                                  : `${diff > 0 ? "+" : ""}₱${Math.abs(diff).toLocaleString()}`
                                : deltaLabel(row.current, row.previous)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="rounded-xl border border-neutral-200/80 bg-white p-4 print:border-0 print:shadow-none">
              <h3 className="mb-3 text-sm font-semibold text-neutral-900">
                {isToday
                  ? t("closeout.snapshot", "Today snapshot")
                  : t("closeout.daySnapshot", "Day snapshot")}
              </h3>
              <CompareBar
                data={chartData}
                height={240}
                emptyLabel={t("closeout.noData", "No closeout data")}
                valueFormatter={(v) => (v >= 1000 ? `₱${(v / 1000).toFixed(1)}k` : String(v))}
              />
            </div>

            {history.length > 0 ? (
              <div className="rounded-xl border border-neutral-200/80 bg-white p-4">
                <h3 className="mb-3 text-sm font-semibold text-neutral-900">
                  {t("closeout.history", "Saved snapshots")}
                </h3>
                <ul className="divide-y text-sm">
                  {history.map((snap) => (
                    <li key={snap.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span className="font-medium text-neutral-800">{snap.snapshot_date}</span>
                      <span className="flex items-center gap-2 text-neutral-500">
                        {snap.finalized ? (
                          <Badge variant="outline" className="font-normal text-xs">
                            {t("closeout.finalizedLabel", "Finalized")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="font-normal text-xs">
                            {t("closeout.draftLabel", "Draft")}
                          </Badge>
                        )}
                        ₱{Number((snap.payload as DailyCloseout)?.collected ?? 0).toLocaleString()} collected
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </ModulePageShell>
    </>
  )
}

export default function DailyCloseoutPage() {
  return (
    <Suspense fallback={<PageLoadingSkeleton variant="list" />}>
      <DailyCloseoutContent />
    </Suspense>
  )
}
