"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchHmoPipelineAnalytics } from "@/lib/analytics/analytics-service"
import { ModuleAnalyticsPanel } from "@/components/analytics/ModuleAnalyticsPanel"
import { useLocale } from "@/hooks/use-locale"

export function HmoAnalyticsPanel({ branchId }: { branchId: string }) {
  const { t } = useLocale()
  const [loading, setLoading] = useState(true)
  const [funnel, setFunnel] = useState<{ label: string; value: number }[]>([])
  const [pendingAmount, setPendingAmount] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await fetchHmoPipelineAnalytics(branchId)
    if (data) {
      setFunnel(data.statusFunnel)
      setPendingAmount(data.pendingAmount)
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
          {t("hmo.pendingAmount", "Pending claim amount")}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
          {loading ? "—" : `₱${pendingAmount.toLocaleString()}`}
        </p>
      </div>
      <ModuleAnalyticsPanel
        title={t("hmo.pipelineFunnel", "Claims pipeline")}
        variant="funnel"
        funnelSteps={funnel.map((f) => ({ label: f.label, value: f.value }))}
        loading={loading}
        height={220}
      />
    </div>
  )
}
