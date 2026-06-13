"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchOwnerAnalytics, type OwnerAnalytics } from "@/lib/analytics/analytics-service"
import { useBranch } from "@/hooks/use-branch"

export function useOwnerAnalytics(periodDays = 7, locale?: string) {
  const { activeBranch } = useBranch()
  const [data, setData] = useState<OwnerAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchOwnerAnalytics(activeBranch?.id ?? null, periodDays, locale)
    setData(result.data)
    setError(result.error)
    setLoading(false)
  }, [activeBranch?.id, periodDays, locale])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, loading, error, reload }
}
