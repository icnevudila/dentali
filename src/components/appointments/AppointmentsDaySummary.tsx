"use client"

import { OpsSummaryGrid } from "@/components/layout/OpsSummaryGrid"
import { useLocale } from "@/hooks/use-locale"
import { appointmentDateKey, parseDateKey } from "@/lib/appointments/week-calendar"
import type { AppointmentRecord } from "@/lib/appointments/types"
import { resolveBookingSource } from "@/lib/appointments/booking-source"

type AppointmentsDaySummaryProps = {
  appointments: AppointmentRecord[]
  selectedDate: string
  isToday: boolean
  loading?: boolean
}

export function AppointmentsDaySummary({
  appointments,
  selectedDate,
  isToday,
  loading,
}: AppointmentsDaySummaryProps) {
  const { t } = useLocale()

  const dayAppts = appointments.filter((a) => appointmentDateKey(a.scheduled_at) === selectedDate)
  const scheduled = dayAppts.filter((a) => a.status === "scheduled" || a.status === "confirmed").length
  const completed = dayAppts.filter((a) => a.status === "completed").length
  const noShow = dayAppts.filter((a) => a.status === "no_show").length
  const cancelled = dayAppts.filter((a) => a.status === "cancelled").length
  const portal = dayAppts.filter((a) => resolveBookingSource(a) === "portal").length

  const formattedDay = parseDateKey(selectedDate).toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  })

  return (
    <OpsSummaryGrid
      title={
        isToday
          ? t("appointments.daySummaryToday", "Today's schedule summary")
          : t("appointments.daySummaryPast", "Schedule summary — {day}").replace("{day}", formattedDay)
      }
      items={[
        {
          label: t("appointments.summaryTotal", "Total"),
          value: loading ? "—" : dayAppts.length,
          sub: t("appointments.summaryTotalSub", "On this clinic day"),
        },
        {
          label: t("appointments.summaryUpcoming", "Upcoming"),
          value: loading ? "—" : scheduled,
          sub: t("appointments.metricUpcomingHint", "Scheduled or confirmed"),
          emphasis: !loading && scheduled > 0 ? "warning" : "default",
        },
        {
          label: t("appointments.summaryCompleted", "Completed"),
          value: loading ? "—" : completed,
          emphasis: !loading && completed > 0 ? "success" : "default",
        },
        {
          label: t("appointments.summaryNoShow", "No-show"),
          value: loading ? "—" : noShow,
          emphasis: !loading && noShow > 0 ? "warning" : "default",
        },
        {
          label: t("appointments.summaryCancelled", "Cancelled"),
          value: loading ? "—" : cancelled,
        },
        ...(portal > 0 || loading
          ? [
              {
                label: t("appointments.metricPortal", "Portal"),
                value: loading ? "—" : portal,
                sub: t("appointments.metricPortalHint", "Online bookings"),
              },
            ]
          : []),
      ]}
      columnsClassName="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
    />
  )
}
