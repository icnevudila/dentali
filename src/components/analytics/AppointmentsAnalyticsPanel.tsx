"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchAppointmentsAnalytics } from "@/lib/analytics/analytics-service"
import { ModuleAnalyticsPanel } from "@/components/analytics/ModuleAnalyticsPanel"
import { AppointmentsPeriodReport } from "@/components/analytics/AppointmentsPeriodReport"
import { MonthlyAppointmentsSnapshot } from "@/components/analytics/MonthlyAppointmentsSnapshot"
import { useLocale } from "@/hooks/use-locale"

export function AppointmentsAnalyticsPanel({
  branchId,
  periodDays = 7,
}: {
  branchId: string
  periodDays?: number
}) {
  const { t } = useLocale()
  const [loading, setLoading] = useState(true)
  const [occupancyPct, setOccupancyPct] = useState(0)
  const [hourlyLoad, setHourlyLoad] = useState<{ label: string; value: number }[]>([])
  const [noShowTrend, setNoShowTrend] = useState<{ label: string; value: number }[]>([])
  const [cancelTrend, setCancelTrend] = useState<{ label: string; value: number }[]>([])
  const [providers, setProviders] = useState<{ label: string; value: number }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await fetchAppointmentsAnalytics(branchId, periodDays)
    if (data) {
      setOccupancyPct(data.occupancyPct)
      setHourlyLoad(data.hourlyLoad)
      setNoShowTrend(data.noShowTrend)
      setCancelTrend(data.cancelTrend)
      setProviders(data.providerUtilization)
    }
    setLoading(false)
  }, [branchId, periodDays])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)]">
      <div className="min-w-0 space-y-4">
        <MonthlyAppointmentsSnapshot branchId={branchId} />

        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <ModuleAnalyticsPanel
            title={t("appointments.hourlyLoad", "Hourly load")}
            subtitle={t("appointments.hourlyLoadHint", "Appointments by hour")}
            variant="line"
            data={hourlyLoad}
            loading={loading}
            height={200}
          />
          <ModuleAnalyticsPanel
            title={t("appointments.noShowTrend", "No-show trend")}
            variant="area"
            data={noShowTrend}
            loading={loading}
            height={200}
          />
        </div>
      </div>

      <AppointmentsPeriodReport
        periodDays={periodDays}
        loading={loading}
        occupancyPct={occupancyPct}
        noShowTrend={noShowTrend}
        cancelTrend={cancelTrend}
        providers={providers}
        hourlyLoad={hourlyLoad}
      />
    </div>
  )
}
