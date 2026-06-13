"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchPatientsAnalytics } from "@/lib/analytics/analytics-service"
import { ModuleAnalyticsPanel } from "@/components/analytics/ModuleAnalyticsPanel"
import { useLocale } from "@/hooks/use-locale"

export function PatientsAnalyticsPanel({ branchId }: { branchId: string }) {
  const { t } = useLocale()
  const [loading, setLoading] = useState(true)
  const [consentPct, setConsentPct] = useState(0)
  const [totalActive, setTotalActive] = useState(0)
  const [newTrend, setNewTrend] = useState<{ label: string; value: number }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await fetchPatientsAnalytics(branchId, 30)
    if (data) {
      setConsentPct(data.consentCompletionPct)
      setTotalActive(data.totalActive)
      setNewTrend(data.newPatientsTrend)
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
            {t("patients.consentRate", "Consent completion")}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
            {loading ? "—" : `${consentPct}%`}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <p className="text-xs font-medium text-neutral-500">
            {t("patients.activeCount", "Active patients")}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
            {loading ? "—" : totalActive}
          </p>
        </div>
      </div>
      <ModuleAnalyticsPanel
        title={t("patients.newTrend", "New patients (30d)")}
        variant="line"
        data={newTrend}
        loading={loading}
        height={200}
      />
    </div>
  )
}
