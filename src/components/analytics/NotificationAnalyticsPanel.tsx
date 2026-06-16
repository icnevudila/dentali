"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchNotificationAnalytics } from "@/lib/analytics/analytics-service"
import { ModuleAnalyticsPanel } from "@/components/analytics/ModuleAnalyticsPanel"
import { useLocale } from "@/hooks/use-locale"

export function NotificationAnalyticsPanel({
  branchId,
  periodDays = 30,
}: {
  branchId: string
  periodDays?: number
}) {
  const { t } = useLocale()
  const [loading, setLoading] = useState(true)
  const [daily, setDaily] = useState<{ label: string; value: number }[]>([])
  const [deliveryRate, setDeliveryRate] = useState(0)
  const [totalSent, setTotalSent] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await fetchNotificationAnalytics(branchId, periodDays)
    if (data) {
      setDaily(data.dailyDelivery)
      setDeliveryRate(data.deliveryRatePct)
      setTotalSent(data.totalSent)
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
          {t("notifications.deliveryRate", "Delivery rate ({days}d)").replace(
            "{days}",
            periodLabel
          )}
        </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
            {loading ? "—" : `${deliveryRate}%`}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <p className="text-xs font-medium text-neutral-500">
          {t("notifications.totalSent", "Messages sent ({days}d)").replace(
            "{days}",
            periodLabel
          )}
        </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
            {loading ? "—" : totalSent}
          </p>
        </div>
      </div>
      <ModuleAnalyticsPanel
        title={t("notifications.dailyDelivery", "Daily delivery")}
        variant="area"
        data={daily}
        loading={loading}
        height={200}
      />
    </div>
  )
}
