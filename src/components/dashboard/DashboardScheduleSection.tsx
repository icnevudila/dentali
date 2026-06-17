"use client"

import * as React from "react"
import Link from "next/link"
import { CalendarDays, ExternalLink } from "lucide-react"
import { AppointmentsAnalyticsPanel } from "@/components/analytics/AppointmentsAnalyticsPanel"
import { ModuleAnalyticsPanel } from "@/components/analytics/ModuleAnalyticsPanel"
import { HorizontalSnapStrip } from "@/components/layout/HorizontalSnapStrip"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/use-locale"
import {
  fetchAppointmentsAnalytics,
  fetchQueueAnalytics,
} from "@/lib/analytics/analytics-service"

type DashboardScheduleSectionProps = {
  branchId: string
  periodDays: 7 | 30 | 90
}

export function DashboardScheduleSection({
  branchId,
  periodDays,
}: DashboardScheduleSectionProps) {
  const { t } = useLocale()
  const periodLabel = String(periodDays)
  const [loading, setLoading] = React.useState(true)
  const [peakHours, setPeakHours] = React.useState<{ label: string; value: number }[]>([])
  const [medianWait, setMedianWait] = React.useState(0)
  const [occupancyPct, setOccupancyPct] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    void Promise.all([
      fetchQueueAnalytics(branchId, periodDays),
      fetchAppointmentsAnalytics(branchId, periodDays),
    ]).then(([queueRes, apptRes]) => {
      if (cancelled) return
      setPeakHours(queueRes.data?.peakHours ?? [])
      setMedianWait(queueRes.data?.medianWaitMinutes ?? 0)
      setOccupancyPct(apptRes.data?.occupancyPct ?? 0)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [branchId, periodDays])

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary-600" aria-hidden />
          <h2 className="text-sm font-semibold text-neutral-900">
            {t("dashboard.sectionSchedule", "Schedule & flow")}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/appointments?date=${new Date().toISOString().slice(0, 10)}`}>
              {t("appointments.openScheduler", "Open scheduler")}
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link href={`/reports?period=${periodDays}&focus=appointments#operations`}>
              <ExternalLink className="h-3.5 w-3.5" />
              {t("dashboard.viewScheduleReports", "Full operations report")}
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,300px)] xl:items-start">
        <AppointmentsAnalyticsPanel branchId={branchId} periodDays={periodDays} compact />

        <HorizontalSnapStrip desktopLayout="flex-col" className="xl:flex xl:flex-col">
          <ModuleAnalyticsPanel
            title={t("queue.peakHours", "Peak check-in hours")}
            subtitle={t(
              "dashboard.peakHoursHint",
              "Busiest arrival windows in the last {days} days"
            ).replace("{days}", periodLabel)}
            variant="bar"
            data={peakHours}
            loading={loading}
            height={160}
          />
          <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <p className="text-sm font-semibold text-neutral-900">
              {t("reports.panelQueueTitle", "Queue pressure")}
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {t(
                "dashboard.queuePressureHint",
                "How long patients wait before chair time starts."
              )}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-neutral-200/80 bg-neutral-50/60 px-3 py-2.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                  {t("queue.medianWait", "Median wait ({days}d)").replace("{days}", periodLabel)}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-neutral-950">
                  {loading ? "—" : `${medianWait} min`}
                </p>
              </div>
              <div className="rounded-lg border border-primary-200/70 bg-primary-50/50 px-3 py-2.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-primary-700/80">
                  {t("appointments.occupancy", "Schedule occupancy ({days}d)").replace(
                    "{days}",
                    periodLabel
                  )}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-neutral-950">
                  {loading ? "—" : `${occupancyPct}%`}
                </p>
              </div>
            </div>
          </div>
        </HorizontalSnapStrip>
      </div>
    </section>
  )
}
