"use client"

import { useCallback, useEffect, useState } from "react"
import { useBranch } from "@/hooks/use-branch"
import { fetchReportsSummary, type ReportsSummary } from "@/lib/reports/reports-service"

export function useReportsSummary(periodDays = 7, locale?: string) {
  const { activeBranch } = useBranch()
  const [summary, setSummary] = useState<ReportsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!activeBranch) {
      setSummary(null)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    const { data, error: err } = await fetchReportsSummary(
      activeBranch.id,
      activeBranch.organization_id,
      periodDays,
      locale
    )
    setSummary(data)
    setError(err)
    setLoading(false)
  }, [activeBranch, periodDays, locale])

  useEffect(() => {
    void reload()
  }, [reload])

  return { summary, loading, error, reload, hasBranch: !!activeBranch }
}
