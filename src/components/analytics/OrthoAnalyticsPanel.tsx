"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchOrthoAnalytics } from "@/lib/analytics/analytics-service"
import { ModuleAnalyticsPanel } from "@/components/analytics/ModuleAnalyticsPanel"
import { useLocale } from "@/hooks/use-locale"

export function OrthoAnalyticsPanel({ branchId }: { branchId: string }) {
  const { t } = useLocale()
  const [loading, setLoading] = useState(true)
  const [activeCases, setActiveCases] = useState(0)
  const [distribution, setDistribution] = useState<{ label: string; value: number }[]>([])
  const [adjustmentTimeline, setAdjustmentTimeline] = useState<{ label: string; value: number }[]>(
    []
  )

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await fetchOrthoAnalytics(branchId)
    if (data) {
      setActiveCases(data.activeCases)
      setDistribution(data.balanceDistribution)
      setAdjustmentTimeline(data.adjustmentTimeline)
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
          {t("ortho.activeCases", "Active ortho cases")}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
          {loading ? "—" : activeCases}
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ModuleAnalyticsPanel
          title={t("ortho.balanceDistribution", "Balance distribution")}
          variant="pie"
          data={distribution}
          loading={loading}
          height={200}
        />
        <ModuleAnalyticsPanel
          title={t("ortho.adjustmentTimeline", "Adjustment timeline (12w)")}
          variant="line"
          data={adjustmentTimeline}
          loading={loading}
          height={200}
        />
      </div>
    </div>
  )
}
