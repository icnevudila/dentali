"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchAppointmentsAnalytics } from "@/lib/analytics/analytics-service"
import { ModuleAnalyticsPanel } from "@/components/analytics/ModuleAnalyticsPanel"
import { MonthlyAppointmentsSnapshot } from "@/components/analytics/MonthlyAppointmentsSnapshot"
import { Sparkline } from "@/components/charts/ChartKit"
import { CHART_COLORS } from "@/lib/charts/chart-tokens"
import { useLocale } from "@/hooks/use-locale"

export function AppointmentsAnalyticsPanel({
  branchId,
  periodDays = 7,
}: {
  branchId: string
  periodDays?: number
}) {
  const { t } = useLocale()
  const [loading, setLoading] = useState(true)
  const [occupancyPct, setOccupancyPct] = useState(0)
  const [hourlyLoad, setHourlyLoad] = useState<{ label: string; value: number }[]>([])
  const [noShowTrend, setNoShowTrend] = useState<{ label: string; value: number }[]>([])
  const [cancelTrend, setCancelTrend] = useState<{ label: string; value: number }[]>([])
  const [providers, setProviders] = useState<{ label: string; value: number }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await fetchAppointmentsAnalytics(branchId, periodDays)
    if (data) {
      setOccupancyPct(data.occupancyPct)
      setHourlyLoad(data.hourlyLoad)
      setNoShowTrend(data.noShowTrend)
      setCancelTrend(data.cancelTrend)
      setProviders(data.providerUtilization)
    }
    setLoading(false)
  }, [branchId, periodDays])

  useEffect(() => {
    void load()
  }, [load])

  const noShowSpark = noShowTrend.map((d) => d.value)
  const cancelSpark = cancelTrend.map((d) => d.value)
  const periodLabel = String(periodDays)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <p className="text-xs font-medium text-neutral-500">
          {t("appointments.occupancy", "Schedule occupancy ({days}d)").replace(
            "{days}",
            periodLabel
          )}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
          {loading ? "—" : `${occupancyPct}%`}
        </p>
      </div>

      <MonthlyAppointmentsSnapshot branchId={branchId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-neutral-500">
              {t("appointments.noShowTrend", "No-show trend ({days}d)").replace(
                "{days}",
                periodLabel
              )}
            </p>
            {!loading && noShowSpark.length >= 2 ? (
              <Sparkline data={noShowSpark} color={CHART_COLORS.warning} />
            ) : null}
          </div>
          <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-900">
            {loading ? "—" : noShowSpark.reduce((a, b) => a + b, 0)}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-neutral-500">
              {t("appointments.cancelTrend", "Cancel trend ({days}d)").replace(
                "{days}",
                periodLabel
              )}
            </p>
            {!loading && cancelSpark.length >= 2 ? (
              <Sparkline data={cancelSpark} color={CHART_COLORS.neutral} />
            ) : null}
          </div>
          <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-900">
            {loading ? "—" : cancelSpark.reduce((a, b) => a + b, 0)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ModuleAnalyticsPanel
          title={t("appointments.hourlyLoad", "Hourly load")}
          subtitle={t("appointments.hourlyLoadHint", "Appointments by hour")}
          variant="line"
          data={hourlyLoad}
          loading={loading}
          height={180}
        />
        <ModuleAnalyticsPanel
          title={t("appointments.noShowTrend", "No-show trend")}
          variant="area"
          data={noShowTrend}
          loading={loading}
          height={180}
        />
      </div>
      <ModuleAnalyticsPanel
        title={t("appointments.dentistUtil", "Dentist utilization")}
        variant="pie"
        data={providers}
        loading={loading}
        height={200}
      />
    </div>
  )
}
