"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Star } from "lucide-react"
import { useLocale } from "@/hooks/use-locale"
import { Button } from "@/components/ui/button"
import {
  fetchSatisfactionSummary,
  type SatisfactionSummary,
} from "@/lib/reports/satisfaction-service"

const EMPTY: SatisfactionSummary = {
  total: 0,
  average: null,
  distribution: [1, 2, 3, 4, 5].map((rating) => ({ rating, count: 0 })),
  recent: [],
}

export function SatisfactionAnalyticsPanel({
  branchId,
  periodDays = 30,
  showLink = true,
  summary: summaryProp,
  loading: loadingProp,
  error: errorProp,
}: {
  branchId: string
  periodDays?: number
  showLink?: boolean
  summary?: SatisfactionSummary
  loading?: boolean
  error?: string | null
}) {
  const { t } = useLocale()
  const controlled = summaryProp !== undefined
  const [loading, setLoading] = useState(!controlled)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<SatisfactionSummary>(EMPTY)

  const load = useCallback(async () => {
    if (controlled) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await fetchSatisfactionSummary(branchId, periodDays)
    setSummary(data)
    setError(err)
    setLoading(false)
  }, [branchId, periodDays, controlled])

  useEffect(() => {
    void load()
  }, [load])

  const display = controlled ? (summaryProp ?? EMPTY) : summary
  const isLoading = controlled ? Boolean(loadingProp) : loading
  const displayError = controlled ? (errorProp ?? null) : error
  const periodLabel = String(periodDays)
  const maxCount = Math.max(1, ...display.distribution.map((d) => d.count))

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <p className="text-xs font-medium text-neutral-500">
            {t("satisfaction.avgLabel", "Average rating ({days}d)").replace("{days}", periodLabel)}
          </p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-semibold tabular-nums text-neutral-900">
            {isLoading ? "—" : display.average != null ? display.average.toFixed(1) : "—"}
            {!isLoading && display.average != null ? (
              <Star className="h-5 w-5 fill-amber-400 text-amber-400" aria-hidden />
            ) : null}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <p className="text-xs font-medium text-neutral-500">
            {t("satisfaction.totalLabel", "Responses ({days}d)").replace("{days}", periodLabel)}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
            {isLoading ? "—" : display.total}
          </p>
        </div>
      </div>

      {displayError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {t(
            "satisfaction.loadError",
            "Could not load satisfaction feedback. Check report permissions."
          )}
        </p>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          {t("satisfaction.distribution", "Rating distribution")}
        </p>
        {display.distribution.map((d) => (
          <div key={d.rating} className="flex items-center gap-3 text-sm">
            <span className="w-8 tabular-nums text-neutral-600">{d.rating}★</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-amber-400 transition-all"
                style={{
                  width: isLoading ? "0%" : `${Math.round((d.count / maxCount) * 100)}%`,
                }}
              />
            </div>
            <span className="w-8 text-right tabular-nums text-neutral-500">{d.count}</span>
          </div>
        ))}
      </div>

      {showLink ? (
        <Button variant="outline" size="sm" asChild>
          <Link href="/reports/satisfaction">
            {t("satisfaction.openFull", "Open satisfaction report")}
          </Link>
        </Button>
      ) : null}
    </div>
  )
}
