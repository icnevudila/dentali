"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Download, Printer, RefreshCw, Save, Wallet } from "lucide-react"
import { printCurrentPage } from "@/lib/utils/print"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import {
  fetchCloseoutHistory,
  fetchDailyCloseout,
  saveCloseoutSnapshot,
  type CloseoutSnapshot,
  type DailyCloseout,
} from "@/lib/analytics/analytics-service"
import { Button } from "@/components/ui/button"
import { CompareBar } from "@/components/charts/ChartKit"

export default function DailyCloseoutPage() {
  const { activeBranch } = useBranch()
  const { t } = useLocale()
  const [data, setData] = useState<DailyCloseout | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<CloseoutSnapshot[]>([])
  const [savingSnapshot, setSavingSnapshot] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [closeout, hist] = await Promise.all([
      fetchDailyCloseout(activeBranch?.id ?? null),
      fetchCloseoutHistory(activeBranch?.id ?? null, 10),
    ])
    setData(closeout.data)
    setHistory(hist.data)
    setError(closeout.error ?? hist.error)
    setLoading(false)
  }, [activeBranch?.id])

  useEffect(() => {
    void reload()
  }, [reload])

  const metrics = data
    ? [
        { label: t("closeout.collected", "Collected today"), value: data.collected },
        { label: t("closeout.openBalance", "Open balance"), value: data.openBalance },
        { label: t("closeout.completed", "Completed visits"), value: data.appointmentsCompleted },
        { label: t("closeout.noShow", "No-shows"), value: data.noShow },
        { label: t("closeout.pendingConsents", "Pending consents"), value: data.pendingConsents },
        { label: t("closeout.hmoPending", "HMO pending"), value: data.hmoPending },
      ]
    : []

  const chartData = metrics.map((m) => ({
    label: m.label.length > 12 ? `${m.label.slice(0, 11)}…` : m.label,
    value: m.value,
  }))

  const handleSaveSnapshot = async () => {
    setSavingSnapshot(true)
    const { error: err } = await saveCloseoutSnapshot(activeBranch?.id ?? null)
    setSavingSnapshot(false)
    if (err) setError(err)
    else void reload()
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

  return (
    <ModulePageShell
      icon={Wallet}
      eyebrow={t("closeout.eyebrow", "Owner · End of day")}
      title={t("closeout.title", "Daily closeout")}
      description={t("closeout.subtitle", "Review collections, open balances, and exceptions before closing the day.")}
      actions={
        <div className="flex flex-wrap gap-2">
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
          <Button variant="outline" size="sm" onClick={() => void handleSaveSnapshot()} disabled={!data || savingSnapshot}>
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {t("closeout.saveSnapshot", "Save snapshot")}
          </Button>
          <Button size="sm" onClick={handleExport} disabled={!data}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            {t("closeout.exportCsv", "Export CSV")}
          </Button>
        </div>
      }
    >
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {metrics.map((m) => (
              <div
                key={m.label}
                className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
              >
                <p className="text-xs font-medium text-neutral-500">{m.label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
                  {loading
                    ? "—"
                    : m.label.includes("Collected") || m.label.includes("balance")
                      ? `₱${Number(m.value).toLocaleString()}`
                      : m.value}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-neutral-200/80 bg-white p-4 print:border-0 print:shadow-none">
            <h3 className="mb-3 text-sm font-semibold text-neutral-900">
              {t("closeout.snapshot", "Today snapshot")}
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
                    <span className="text-neutral-500">
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
  )
}
