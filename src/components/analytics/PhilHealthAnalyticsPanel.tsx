"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchPhilHealthAnalytics } from "@/lib/analytics/analytics-service"
import { ModuleAnalyticsPanel } from "@/components/analytics/ModuleAnalyticsPanel"
import { useLocale } from "@/hooks/use-locale"

export function PhilHealthAnalyticsPanel({ branchId }: { branchId: string }) {
  const { t } = useLocale()
  const [loading, setLoading] = useState(true)
  const [breakdown, setBreakdown] = useState<{ label: string; value: number }[]>([])
  const [readinessPct, setReadinessPct] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await fetchPhilHealthAnalytics(branchId)
    if (data) {
      setBreakdown(data.statusBreakdown)
      setReadinessPct(data.readinessPct)
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
          {t("philhealth.readiness", "Checklist readiness")}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-700">
          {loading ? "—" : `${readinessPct}%`}
        </p>
      </div>
      <ModuleAnalyticsPanel
        title={t("philhealth.statusMix", "Claim status")}
        variant="pie"
        data={breakdown}
        loading={loading}
        height={200}
      />
    </div>
  )
}
