"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchAppointmentsAnalytics } from "@/lib/analytics/analytics-service"
import { ModuleAnalyticsPanel } from "@/components/analytics/ModuleAnalyticsPanel"
import { ScheduleHeatmap } from "@/components/charts/ScheduleHeatmap"
import { Sparkline } from "@/components/charts/ChartKit"
import { CHART_COLORS } from "@/lib/charts/chart-tokens"
import { useLocale } from "@/hooks/use-locale"

export function AppointmentsAnalyticsPanel({ branchId }: { branchId: string }) {
  const { t } = useLocale()
  const [loading, setLoading] = useState(true)
  const [occupancyPct, setOccupancyPct] = useState(0)
  const [hourlyLoad, setHourlyLoad] = useState<{ label: string; value: number }[]>([])
  const [noShowTrend, setNoShowTrend] = useState<{ label: string; value: number }[]>([])
  const [cancelTrend, setCancelTrend] = useState<{ label: string; value: number }[]>([])
  const [heatmap, setHeatmap] = useState<{ dow: string; hour: string; value: number }[]>([])
  const [providers, setProviders] = useState<{ label: string; value: number }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await fetchAppointmentsAnalytics(branchId, 7)
    if (data) {
      setOccupancyPct(data.occupancyPct)
      setHourlyLoad(data.hourlyLoad)
      setNoShowTrend(data.noShowTrend)
      setCancelTrend(data.cancelTrend)
      setHeatmap(data.dayHourHeatmap)
      setProviders(data.providerUtilization)
    }
    setLoading(false)
  }, [branchId])

  useEffect(() => {
    void load()
  }, [load])

  const noShowSpark = noShowTrend.map((d) => d.value)
  const cancelSpark = cancelTrend.map((d) => d.value)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <p className="text-xs font-medium text-neutral-500">
          {t("appointments.occupancy", "Schedule occupancy (7d)")}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
          {loading ? "—" : `${occupancyPct}%`}
        </p>
      </div>

      <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <h3 className="text-sm font-semibold text-neutral-900">
          {t("appointments.scheduleHeatmap", "Schedule heatmap (7d)")}
        </h3>
        <p className="mt-0.5 text-xs text-neutral-500">
          {t("appointments.scheduleHeatmapHint", "Appointments by day and hour")}
        </p>
        <div className="mt-3">
          <ScheduleHeatmap
            cells={heatmap}
            loading={loading}
            emptyLabel={t("common.noData", "No data yet")}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-neutral-500">
              {t("appointments.noShowTrend", "No-show trend (7d)")}
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
              {t("appointments.cancelTrend", "Cancel trend (7d)")}
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
        title={t("appointments.providerUtil", "Provider utilization")}
        variant="pie"
        data={providers}
        loading={loading}
        height={200}
      />
    </div>
  )
}
