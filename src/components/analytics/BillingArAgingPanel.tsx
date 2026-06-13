"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchArAging } from "@/lib/analytics/analytics-service"
import { ModuleAnalyticsPanel } from "@/components/analytics/ModuleAnalyticsPanel"
import { useLocale } from "@/hooks/use-locale"

export function BillingArAgingPanel({ branchId }: { branchId: string }) {
  const { t } = useLocale()
  const [loading, setLoading] = useState(true)
  const [buckets, setBuckets] = useState<{ label: string; value: number }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await fetchArAging(branchId)
    setBuckets(data)
    setLoading(false)
  }, [branchId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <ModuleAnalyticsPanel
      title={t("billing.arAging", "Open balance aging")}
      subtitle={t("billing.arAgingHint", "Outstanding invoices by age")}
      variant="bar"
      data={buckets}
      loading={loading}
      valueFormatter={(v) => `₱${v.toLocaleString()}`}
      height={200}
    />
  )
}
