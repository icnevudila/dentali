"use client"

import Link from "next/link"
import { BarChart3, TrendingUp, Wallet } from "lucide-react"
import { TrendArea, TrendLine } from "@/components/charts/ChartKit"
import { StatusBreakdown } from "@/components/charts/StatusBreakdown"
import type { ReportsSummary } from "@/lib/reports/reports-service"
import { Button } from "@/components/ui/button"

type PeriodDays = 7 | 30 | 90

type DashboardVisualPanelProps = {
  summary: ReportsSummary | null
  loading: boolean
  periodDays: PeriodDays
  onPeriodChange: (days: PeriodDays) => void
  reportsHref?: string
  labels: {
    weekAppointments: string
    weekCollections: string
    statusMix: string
    viewReports: string
    loading: string
    periodHint: string
    periodLabel: string
    emptyChart: string
    emptyStatus: string
  }
}

const PERIOD_OPTIONS: PeriodDays[] = [7, 30, 90]

export function DashboardVisualPanel({
  summary,
  loading,
  periodDays,
  onPeriodChange,
  reportsHref,
  labels,
}: DashboardVisualPanelProps) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{labels.periodHint}</p>
          <div
            className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50/80 p-0.5"
            role="group"
            aria-label={labels.periodLabel}
          >
            {PERIOD_OPTIONS.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => onPeriodChange(days)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  periodDays === days
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-800"
                }`}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>
        <Button variant="outline" size="sm" asChild className="gap-1.5">
          <Link href={reportsHref ?? `/reports?period=${periodDays}&focus=appointments#operations`}>
            <BarChart3 className="h-3.5 w-3.5" />
            {labels.viewReports}
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] lg:col-span-1">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary-600" aria-hidden />
            <h3 className="text-sm font-semibold text-neutral-900">{labels.weekAppointments}</h3>
          </div>
          {loading || !summary ? (
            <div className="flex h-36 items-center justify-center text-sm text-neutral-400">{labels.loading}</div>
          ) : (
            <TrendLine
              data={summary.dailyAppointments.map((d) => ({ label: d.label, value: d.value }))}
              emptyLabel={labels.emptyChart}
              height={144}
            />
          )}
        </div>

        <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] lg:col-span-1">
          <div className="mb-3 flex items-center gap-2">
            <Wallet className="h-4 w-4 text-emerald-600" aria-hidden />
            <h3 className="text-sm font-semibold text-neutral-900">{labels.weekCollections}</h3>
          </div>
          {loading || !summary ? (
            <div className="flex h-36 items-center justify-center text-sm text-neutral-400">{labels.loading}</div>
          ) : (
            <TrendArea
              data={summary.dailyCollections.map((d) => ({ label: d.label, value: d.value }))}
              valueFormatter={(v) => (v >= 1000 ? `₱${(v / 1000).toFixed(1)}k` : `₱${v}`)}
              emptyLabel={labels.emptyChart}
              height={144}
            />
          )}
        </div>

        <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] lg:col-span-1">
          <h3 className="mb-3 text-sm font-semibold text-neutral-900">{labels.statusMix}</h3>
          {loading || !summary ? (
            <div className="flex h-36 items-center justify-center text-sm text-neutral-400">{labels.loading}</div>
          ) : (
            <StatusBreakdown slices={summary.statusBreakdown} emptyLabel={labels.emptyStatus} />
          )}
        </div>
      </div>
    </section>
  )
}
