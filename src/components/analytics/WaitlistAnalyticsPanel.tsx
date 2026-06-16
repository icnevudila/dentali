"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchWaitlistAnalytics } from "@/lib/analytics/analytics-service"
import { ModuleAnalyticsPanel } from "@/components/analytics/ModuleAnalyticsPanel"
import { useLocale } from "@/hooks/use-locale"

export function WaitlistAnalyticsPanel({
  branchId,
  periodDays = 30,
}: {
  branchId: string
  periodDays?: number
}) {
  const { t } = useLocale()
  const [loading, setLoading] = useState(true)
  const [conversionPct, setConversionPct] = useState(0)
  const [activeWaiting, setActiveWaiting] = useState(0)
  const [funnel, setFunnel] = useState<{ label: string; value: number }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await fetchWaitlistAnalytics(branchId, periodDays)
    if (data) {
      setConversionPct(data.conversionPct)
      setActiveWaiting(data.activeWaiting)
      setFunnel(data.statusFunnel)
    }
    setLoading(false)
  }, [branchId, periodDays])

  const periodLabel = String(periodDays)

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <p className="text-xs font-medium text-neutral-500">
          {t("waitlist.conversion", "Conversion ({days}d)").replace("{days}", periodLabel)}
        </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
            {loading ? "—" : `${conversionPct}%`}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <p className="text-xs font-medium text-neutral-500">
            {t("waitlist.activeWaiting", "Active waiting")}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
            {loading ? "—" : activeWaiting}
          </p>
        </div>
      </div>
      <ModuleAnalyticsPanel
        title={t("waitlist.statusFunnel", "Status funnel")}
        variant="funnel"
        funnelSteps={funnel.map((s) => ({ label: s.label, value: s.value }))}
        loading={loading}
      />
    </div>
  )
}
