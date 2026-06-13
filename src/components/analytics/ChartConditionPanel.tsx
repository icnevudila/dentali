"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchBranchChartConditionAnalytics } from "@/lib/analytics/analytics-service"
import { ModuleAnalyticsPanel } from "@/components/analytics/ModuleAnalyticsPanel"
import { useLocale } from "@/hooks/use-locale"

export function ChartConditionPanel({ branchId }: { branchId: string }) {
  const { t } = useLocale()
  const [loading, setLoading] = useState(true)
  const [conditions, setConditions] = useState<{ label: string; value: number }[]>([])
  const [totalFindings, setTotalFindings] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, totalFindings: total } = await fetchBranchChartConditionAnalytics(branchId)
    setConditions(data)
    setTotalFindings(total)
    setLoading(false)
  }, [branchId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3">
        <p className="text-xs font-medium text-neutral-500">
          {t("chart.activeFindings", "Active chart findings (branch)")}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {loading ? "—" : totalFindings.toLocaleString()}
        </p>
      </div>
      <ModuleAnalyticsPanel
        title={t("chart.conditionMix", "Condition distribution")}
        variant="pie"
        data={conditions}
        loading={loading}
        height={200}
        emptyLabel={t("chart.noFindings", "No active findings recorded")}
      />
    </div>
  )
}
