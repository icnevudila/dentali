"use client"

import Link from "next/link"
import { CalendarDays } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { AppointmentWeekCalendar } from "@/components/appointments/AppointmentWeekCalendar"
import {
  fetchAppointmentsRange,
  type AppointmentRecord,
} from "@/lib/appointments/appointment-service"
import {
  addDays,
  parseDateKey,
  startOfWeekMonday,
  toDateKey,
} from "@/lib/appointments/week-calendar"
import { fetchOrgStaff, type StaffMember } from "@/lib/staff/staff-service"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/use-locale"

export function AppointmentsAnalyticsPanel({
  branchId,
  periodDays = 7,
  compact = false,
}: {
  branchId: string
  periodDays?: number
  compact?: boolean
}) {
  const { t } = useLocale()
  const today = toDateKey(new Date())
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()))
  const [selectedDate, setSelectedDate] = useState(today)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([])
  const [providers, setProviders] = useState<StaffMember[]>([])

  const load = useCallback(() => {
    setLoading(true)
    const start = toDateKey(addDays(weekStart, -15))
    const end = toDateKey(addDays(weekStart, 45))
    void Promise.all([fetchAppointmentsRange(branchId, start, end), fetchOrgStaff()]).then(
      ([appointmentsRes, staffRes]) => {
        setAppointments(appointmentsRes.data)
        setProviders(staffRes.data.filter((staff) => staff.is_active))
        setError(appointmentsRes.error ?? staffRes.error)
        setLoading(false)
      }
    )
  }, [branchId, weekStart])

  useEffect(() => {
    const id = window.setTimeout(() => {
      load()
    }, 0)
    return () => window.clearTimeout(id)
  }, [load])

  return (
    <div className="min-w-0 max-w-full space-y-4">
      {compact ? null : (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-neutral-200/80 bg-neutral-50/60 p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary-600" aria-hidden />
              <h3 className="text-sm font-semibold text-neutral-900">
                {t("appointments.calendarReportTitle", "Appointment calendar report")}
              </h3>
            </div>
            <p className="max-w-3xl text-xs leading-5 text-neutral-500">
              {t(
                "appointments.calendarReportHint",
                "Read-only appointment scheduler view. Review who is booked, which dentist is assigned, the visit reason, and daily load without changing live appointments."
              )}
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/appointments?date=${selectedDate}`}>
              {t("appointments.openScheduler", "Open scheduler")}
            </Link>
          </Button>
        </div>
      )}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-neutral-200/80 bg-white p-5">
          <div className="h-8 w-48 rounded bg-neutral-200" />
          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
            {Array.from({ length: 14 }).map((_, index) => (
              <div key={index} className="h-28 rounded-lg bg-neutral-100" />
            ))}
          </div>
        </div>
      ) : (
        <AppointmentWeekCalendar
          appointments={appointments}
          weekStart={weekStart}
          onWeekChange={setWeekStart}
          selectedDate={selectedDate}
          onSelectDate={(dateKey) => {
            setSelectedDate(dateKey)
            setWeekStart(startOfWeekMonday(parseDateKey(dateKey)))
          }}
          providers={providers}
        />
      )}
    </div>
  )
}
