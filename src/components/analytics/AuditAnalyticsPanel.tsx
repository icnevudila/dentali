"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchAuditAnalytics } from "@/lib/analytics/analytics-service"
import { ModuleAnalyticsPanel } from "@/components/analytics/ModuleAnalyticsPanel"
import { useLocale } from "@/hooks/use-locale"

export function AuditAnalyticsPanel({ branchId }: { branchId: string | null }) {
  const { t } = useLocale()
  const [loading, setLoading] = useState(true)
  const [totalEvents, setTotalEvents] = useState(0)
  const [daily, setDaily] = useState<{ label: string; value: number }[]>([])
  const [topActions, setTopActions] = useState<{ label: string; value: number }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await fetchAuditAnalytics(branchId, 7)
    if (data) {
      setTotalEvents(data.totalEvents)
      setDaily(data.dailyEvents)
      setTopActions(data.topActions)
    }
    setLoading(false)
  }, [branchId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <p className="text-xs font-medium text-neutral-500">
          {t("audit.totalEvents", "Events (7d)")}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
          {loading ? "—" : totalEvents}
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ModuleAnalyticsPanel
          title={t("audit.dailyVolume", "Daily volume")}
          variant="area"
          data={daily}
          loading={loading}
          height={180}
        />
        <ModuleAnalyticsPanel
          title={t("audit.topActions", "Top actions")}
          variant="pie"
          data={topActions}
          loading={loading}
          height={180}
        />
      </div>
    </div>
  )
}
