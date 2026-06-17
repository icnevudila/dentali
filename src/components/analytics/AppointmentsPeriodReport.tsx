"use client"

import { Activity, Clock3, Stethoscope, TrendingDown, TrendingUp } from "lucide-react"
import { Sparkline } from "@/components/charts/ChartKit"
import { ModuleAnalyticsPanel } from "@/components/analytics/ModuleAnalyticsPanel"
import { CHART_COLORS } from "@/lib/charts/chart-tokens"
import { useLocale } from "@/hooks/use-locale"
import { cn } from "@/lib/utils"

type TrendPoint = { label: string; value: number }

type AppointmentsPeriodReportProps = {
  periodDays: number
  loading: boolean
  occupancyPct: number
  noShowTrend: TrendPoint[]
  cancelTrend: TrendPoint[]
  providers: TrendPoint[]
  hourlyLoad: TrendPoint[]
  className?: string
}

function total(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0)
}

function peakHourLabel(hourlyLoad: TrendPoint[]): string | null {
  if (hourlyLoad.length === 0) return null
  const peak = hourlyLoad.reduce((best, row) => (row.value > best.value ? row : best), hourlyLoad[0])
  if (peak.value <= 0) return null
  return peak.label
}

export function AppointmentsPeriodReport({
  periodDays,
  loading,
  occupancyPct,
  noShowTrend,
  cancelTrend,
  providers,
  hourlyLoad,
  className,
}: AppointmentsPeriodReportProps) {
  const { t } = useLocale()
  const periodLabel = String(periodDays)
  const noShowSpark = noShowTrend.map((d) => d.value)
  const cancelSpark = cancelTrend.map((d) => d.value)
  const noShowTotal = total(noShowSpark)
  const cancelTotal = total(cancelSpark)
  const peakHour = peakHourLabel(hourlyLoad)
  const topProviders = [...providers].sort((a, b) => b.value - a.value).slice(0, 5)
  const leakagePct =
    noShowTotal + cancelTotal > 0
      ? Math.round((noShowTotal / Math.max(noShowTotal + cancelTotal, 1)) * 100)
      : 0

  return (
    <aside
      className={cn(
        "min-w-0 space-y-3 xl:sticky xl:top-4 xl:self-start",
        className
      )}
      aria-label={t("appointments.periodReportLabel", "Period summary report")}
    >
      <div className="overflow-hidden rounded-xl border border-primary-200/70 bg-gradient-to-b from-primary-50/80 to-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="border-b border-primary-100/80 px-4 py-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary-600" aria-hidden />
            <h4 className="text-sm font-semibold text-neutral-900">
              {t("appointments.periodReportTitle", "{days}-day period report").replace(
                "{days}",
                periodLabel
              )}
            </h4>
          </div>
          <p className="mt-1 text-xs leading-5 text-neutral-500">
            {t(
              "appointments.periodReportHint",
              "Quick read of schedule pressure, leakage, and chair demand for the selected window."
            )}
          </p>
        </div>

        <div className="space-y-3 p-4">
          <div className="rounded-lg border border-neutral-200/80 bg-white px-3 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              {t("appointments.occupancy", "Schedule occupancy ({days}d)").replace(
                "{days}",
                periodLabel
              )}
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-neutral-950">
              {loading ? "—" : `${occupancyPct}%`}
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-primary-500 transition-all"
                style={{ width: loading ? "0%" : `${Math.min(100, occupancyPct)}%` }}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <div className="rounded-lg border border-amber-200/70 bg-amber-50/50 px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-medium text-amber-800/80">
                    {t("appointments.noShowTrend", "No-show trend ({days}d)").replace(
                      "{days}",
                      periodLabel
                    )}
                  </p>
                  <p className="mt-0.5 text-xl font-bold tabular-nums text-amber-950">
                    {loading ? "—" : noShowTotal}
                  </p>
                </div>
                {!loading && noShowSpark.length >= 2 ? (
                  <Sparkline data={noShowSpark} color={CHART_COLORS.warning} width={72} height={28} />
                ) : null}
              </div>
            </div>

            <div className="rounded-lg border border-neutral-200/80 bg-neutral-50/60 px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-medium text-neutral-600">
                    {t("appointments.cancelTrend", "Cancel trend ({days}d)").replace(
                      "{days}",
                      periodLabel
                    )}
                  </p>
                  <p className="mt-0.5 text-xl font-bold tabular-nums text-neutral-900">
                    {loading ? "—" : cancelTotal}
                  </p>
                </div>
                {!loading && cancelSpark.length >= 2 ? (
                  <Sparkline data={cancelSpark} color={CHART_COLORS.neutral} width={72} height={28} />
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200/80 bg-white px-3 py-3">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              <Clock3 className="h-3.5 w-3.5" aria-hidden />
              {t("appointments.peakHour", "Peak hour")}
            </div>
            <p className="mt-1 text-lg font-semibold text-neutral-900">
              {loading ? "—" : peakHour ?? t("appointments.peakHourEmpty", "No peak yet")}
            </p>
            {peakHour ? (
              <p className="mt-0.5 text-xs text-neutral-500">
                {t("appointments.peakHourHint", "Busiest appointment slot in this period")}
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border border-neutral-200/80 bg-white px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                {t("appointments.leakageMix", "Schedule leakage")}
              </p>
              {!loading && noShowTotal + cancelTotal > 0 ? (
                noShowTotal >= cancelTotal ? (
                  <TrendingDown className="h-4 w-4 text-amber-600" aria-hidden />
                ) : (
                  <TrendingUp className="h-4 w-4 text-neutral-500" aria-hidden />
                )
              ) : null}
            </div>
            <p className="mt-1 text-sm text-neutral-700">
              {loading
                ? "—"
                : noShowTotal + cancelTotal === 0
                  ? t("appointments.leakageClear", "No no-shows or cancellations in period")
                  : t("appointments.leakageSummary", "{noShow} no-shows · {cancel} cancellations · {pct}% no-show share")
                      .replace("{noShow}", String(noShowTotal))
                      .replace("{cancel}", String(cancelTotal))
                      .replace("{pct}", String(leakagePct))}
            </p>
          </div>

          {topProviders.length > 0 ? (
            <div className="rounded-lg border border-neutral-200/80 bg-white px-3 py-3">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                <Stethoscope className="h-3.5 w-3.5" aria-hidden />
                {t("appointments.topProviders", "Top dentists")}
              </div>
              <ul className="space-y-2">
                {topProviders.map((provider, index) => {
                  const max = topProviders[0]?.value ?? 1
                  const width = Math.max(8, Math.round((provider.value / max) * 100))
                  return (
                    <li key={provider.label}>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate text-neutral-700">
                          <span className="mr-1.5 tabular-nums text-neutral-400">{index + 1}.</span>
                          {provider.label}
                        </span>
                        <span className="shrink-0 tabular-nums font-semibold text-neutral-900">
                          {loading ? "—" : provider.value}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                        <div
                          className="h-full rounded-full bg-primary-400/80"
                          style={{ width: loading ? "0%" : `${width}%` }}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      <ModuleAnalyticsPanel
        title={t("appointments.dentistUtil", "Dentist utilization")}
        variant="pie"
        data={providers}
        loading={loading}
        height={180}
      />
    </aside>
  )
}
