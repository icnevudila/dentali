"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchFinanceSummaryAnalytics } from "@/lib/analytics/analytics-service"
import { BillingArAgingPanel } from "@/components/analytics/BillingArAgingPanel"
import { DistributionPie } from "@/components/charts/ChartKit"
import { useLocale } from "@/hooks/use-locale"

export function FinanceSummaryPanel({ branchId }: { branchId: string | null }) {
  const { t } = useLocale()
  const [loading, setLoading] = useState(true)
  const [openAr, setOpenAr] = useState(0)
  const [openCount, setOpenCount] = useState(0)
  const [hmoPending, setHmoPending] = useState(0)
  const [hmoDraftCount, setHmoDraftCount] = useState(0)

  const load = useCallback(async () => {
    if (!branchId) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await fetchFinanceSummaryAnalytics(branchId)
    if (data) {
      setOpenAr(data.openAr)
      setOpenCount(data.openInvoiceCount)
      setHmoPending(data.hmoPendingAmount)
      setHmoDraftCount(data.hmoDraftCount)
    }
    setLoading(false)
  }, [branchId])

  useEffect(() => {
    void load()
  }, [load])

  if (!branchId) return null

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3">
          <p className="text-xs font-medium text-neutral-500">
            {t("finance.openAr", "Open AR")}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {loading ? "—" : `₱${openAr.toLocaleString()}`}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3">
          <p className="text-xs font-medium text-neutral-500">
            {t("finance.openInvoices", "Open invoices")}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{loading ? "—" : openCount}</p>
        </div>
        <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3">
          <p className="text-xs font-medium text-neutral-500">
            {t("finance.hmoPending", "HMO pending")}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {loading ? "—" : `₱${hmoPending.toLocaleString()}`}
          </p>
        </div>
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 px-4 py-3">
          <p className="text-xs font-medium text-neutral-500">
            {t("finance.hmoDrafts", "HMO drafts")}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-900">
            {loading ? "—" : hmoDraftCount}
          </p>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200/80 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-neutral-900">
            {t("finance.openArVsHmo", "Open AR vs HMO pending")}
          </h3>
          <DistributionPie
            data={[
              { label: t("finance.openAr", "Open AR"), value: openAr },
              { label: t("finance.hmoPending", "HMO pending"), value: hmoPending },
            ]}
            height={200}
            emptyLabel={t("dashboard.chartEmpty", "No activity in this period")}
            valueFormatter={(v) => `₱${v.toLocaleString()}`}
          />
        </div>
        <BillingArAgingPanel branchId={branchId} />
      </div>
    </div>
  )
}
