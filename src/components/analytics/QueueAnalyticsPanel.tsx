"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchQueueAnalytics } from "@/lib/analytics/analytics-service"
import { ModuleAnalyticsPanel } from "@/components/analytics/ModuleAnalyticsPanel"
import { useLocale } from "@/hooks/use-locale"

export function QueueAnalyticsPanel({
  branchId,
  periodDays = 7,
}: {
  branchId: string
  periodDays?: number
}) {
  const { t } = useLocale()
  const [loading, setLoading] = useState(true)
  const [medianWait, setMedianWait] = useState(0)
  const [peakHours, setPeakHours] = useState<{ label: string; value: number }[]>([])
  const [todayFlow, setTodayFlow] = useState<{ label: string; value: number }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await fetchQueueAnalytics(branchId, periodDays)
    if (data) {
      setMedianWait(data.medianWaitMinutes)
      setPeakHours(data.peakHours)
      setTodayFlow(data.todayFlow)
    }
    setLoading(false)
  }, [branchId, periodDays])

  const periodLabel = String(periodDays)

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <p className="text-xs font-medium text-neutral-500">
          {t("queue.medianWait", "Median wait ({days}d)").replace("{days}", periodLabel)}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
          {loading ? "—" : `${medianWait} min`}
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ModuleAnalyticsPanel
          title={t("queue.peakHours", "Peak check-in hours")}
          variant="bar"
          data={peakHours}
          loading={loading}
          height={180}
        />
        <ModuleAnalyticsPanel
          title={t("queue.todayFlow", "Today's queue flow")}
          variant="funnel"
          funnelSteps={todayFlow.map((s) => ({ label: s.label, value: s.value }))}
          loading={loading}
        />
      </div>
    </div>
  )
}
