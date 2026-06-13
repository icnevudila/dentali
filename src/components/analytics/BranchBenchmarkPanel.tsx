"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchBranchBenchmark } from "@/lib/analytics/analytics-service"
import { ModuleAnalyticsPanel } from "@/components/analytics/ModuleAnalyticsPanel"
import { useLocale } from "@/hooks/use-locale"

export function BranchBenchmarkPanel({ periodDays = 30 }: { periodDays?: number }) {
  const { t } = useLocale()
  const [loading, setLoading] = useState(true)
  const [appointments, setAppointments] = useState<{ label: string; value: number }[]>([])
  const [collected, setCollected] = useState<{ label: string; value: number }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await fetchBranchBenchmark(periodDays)
    setAppointments(data.map((r) => ({ label: r.label, value: r.appointments })))
    setCollected(data.map((r) => ({ label: r.label, value: r.collected })))
    setLoading(false)
  }, [periodDays])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ModuleAnalyticsPanel
        title={t("reports.benchmarkAppointments", "Appointments by branch")}
        subtitle={t("reports.benchmarkPeriod", "{days}d period").replace("{days}", String(periodDays))}
        variant="bar"
        data={appointments}
        loading={loading}
        height={220}
      />
      <ModuleAnalyticsPanel
        title={t("reports.benchmarkCollected", "Collections by branch")}
        subtitle={t("reports.benchmarkPeriod", "{days}d period").replace("{days}", String(periodDays))}
        variant="area"
        data={collected}
        loading={loading}
        valueFormatter={(v) => (v >= 1000 ? `₱${(v / 1000).toFixed(1)}k` : `₱${v}`)}
        height={220}
      />
    </div>
  )
}
