"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchKioskAnalytics } from "@/lib/analytics/analytics-service"
import { ModuleAnalyticsPanel } from "@/components/analytics/ModuleAnalyticsPanel"
import { useLocale } from "@/hooks/use-locale"

export function KioskAnalyticsPanel({ branchId }: { branchId: string }) {
  const { t } = useLocale()
  const [loading, setLoading] = useState(true)
  const [daily, setDaily] = useState<{ label: string; value: number }[]>([])
  const [totalCheckins, setTotalCheckins] = useState(0)
  const [intakes, setIntakes] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await fetchKioskAnalytics(branchId, 7)
    if (data) {
      setDaily(data.dailyCheckins)
      setTotalCheckins(data.totalPeriod)
      setIntakes(data.intakesPeriod)
    }
    setLoading(false)
  }, [branchId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <p className="text-xs font-medium text-neutral-500">
            {t("kiosk.checkins7d", "Kiosk check-ins (7d)")}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
            {loading ? "—" : totalCheckins}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <p className="text-xs font-medium text-neutral-500">
            {t("kiosk.intakes7d", "Kiosk intakes (7d)")}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
            {loading ? "—" : intakes}
          </p>
        </div>
      </div>
      <ModuleAnalyticsPanel
        title={t("kiosk.dailyCheckins", "Daily kiosk check-ins")}
        variant="line"
        data={daily}
        loading={loading}
        height={200}
      />
    </div>
  )
}
