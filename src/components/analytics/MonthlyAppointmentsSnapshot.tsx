"use client"

import * as React from "react"
import { CalendarDays } from "lucide-react"
import type { AppointmentRecord } from "@/lib/appointments/types"
import { fetchAppointmentsRange } from "@/lib/appointments/appointment-service"
import {
  DAY_LABELS,
  MANILA_TZ,
  addDays,
  appointmentDateKey,
  formatAppointmentTime,
  getWeekDays,
  parseDateKey,
  startOfWeekMonday,
  toDateKey,
} from "@/lib/appointments/week-calendar"
import { fetchOrgStaff } from "@/lib/staff/staff-service"
import { useLocale } from "@/hooks/use-locale"
import { cn } from "@/lib/utils"

type MonthlyAppointmentsSnapshotProps = {
  branchId: string
  className?: string
  maxVisiblePerDay?: number
}

const STATUS_DOT_CLASS: Record<string, string> = {
  scheduled: "bg-sky-500",
  confirmed: "bg-primary-500",
  checked_in: "bg-violet-500",
  completed: "bg-emerald-500",
  cancelled: "bg-neutral-300",
  no_show: "bg-amber-500",
}

function buildMonthWeeks(anchorDate: Date) {
  const monthStartKey = `${toDateKey(anchorDate).slice(0, 7)}-01`
  const monthStartDate = parseDateKey(monthStartKey)
  const monthEndDate = new Date(monthStartDate)
  monthEndDate.setMonth(monthEndDate.getMonth() + 1)
  monthEndDate.setDate(0)

  const gridStartDate = startOfWeekMonday(monthStartDate)
  const lastWeekStartKey = toDateKey(startOfWeekMonday(monthEndDate))
  const weeks: Date[][] = []

  let cursor = gridStartDate
  while (toDateKey(cursor) <= lastWeekStartKey) {
    weeks.push(getWeekDays(cursor))
    cursor = addDays(cursor, 7)
  }

  return {
    monthStartKey,
    monthLabel: monthStartDate.toLocaleDateString("en-PH", {
      month: "long",
      year: "numeric",
      timeZone: MANILA_TZ,
    }),
    weeks,
  }
}

function providerLabel(providerId: string | null | undefined, providers: Map<string, string>) {
  if (!providerId) return "Unassigned"
  return providers.get(providerId) ?? "Assigned dentist"
}

function appointmentPurposeLabel(appointment: AppointmentRecord) {
  return appointment.purpose?.trim() || "General visit"
}

export function MonthlyAppointmentsSnapshot({
  branchId,
  className,
  maxVisiblePerDay = 2,
}: MonthlyAppointmentsSnapshotProps) {
  const { t } = useLocale()
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [appointments, setAppointments] = React.useState<AppointmentRecord[]>([])
  const [providerNames, setProviderNames] = React.useState<Map<string, string>>(new Map())

  const calendar = React.useMemo(() => buildMonthWeeks(new Date()), [])

  React.useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError(null)

      const monthStartKey = calendar.monthStartKey
      const lastWeek = calendar.weeks[calendar.weeks.length - 1]
      const monthEndKey = toDateKey(lastWeek[lastWeek.length - 1])

      const [appointmentsRes, staffRes] = await Promise.all([
        fetchAppointmentsRange(branchId, monthStartKey, monthEndKey),
        fetchOrgStaff(),
      ])

      if (!active) return

      setAppointments(appointmentsRes.data)
      setError(appointmentsRes.error ?? staffRes.error)
      setProviderNames(
        new Map(
          staffRes.data.map((member) => [
            member.profile_id,
            member.full_name?.trim() || member.email?.split("@")[0] || "Dentist",
          ])
        )
      )
      setLoading(false)
    }

    void load()

    return () => {
      active = false
    }
  }, [branchId, calendar.monthStartKey, calendar.weeks])

  const appointmentMap = React.useMemo(() => {
    const map = new Map<string, AppointmentRecord[]>()
    for (const appointment of appointments) {
      const key = appointmentDateKey(appointment.scheduled_at)
      const current = map.get(key) ?? []
      current.push(appointment)
      current.sort(
        (left, right) => new Date(left.scheduled_at).getTime() - new Date(right.scheduled_at).getTime()
      )
      map.set(key, current)
    }
    return map
  }, [appointments])

  const bookedSlots = appointments.length
  const busyDays = React.useMemo(() => {
    let total = 0
    for (const entries of appointmentMap.values()) {
      if (entries.length > 0) total += 1
    }
    return total
  }, [appointmentMap])

  return (
    <section
      className={cn(
        "rounded-xl border border-neutral-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary-600" aria-hidden />
            <h3 className="text-sm font-semibold text-neutral-900">
              {t("appointments.monthBoardTitle", "Monthly appointment board")}
            </h3>
          </div>
          <p className="text-xs text-neutral-500">
            {calendar.monthLabel} · {bookedSlots} {t("appointments.monthBoardBooked", "booked slots")} · {busyDays}{" "}
            {t("appointments.monthBoardBusyDays", "active days")}
          </p>
        </div>
        <p className="max-w-sm text-xs leading-5 text-neutral-500">
          {t(
            "appointments.monthBoardHint",
            "Read-only monthly view showing time, patient, assigned dentist, and visit reason before you open the live scheduler."
          )}
        </p>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <div className="grid min-w-[860px] grid-cols-7 gap-2">
          {DAY_LABELS.map((dayLabel) => (
            <div
              key={dayLabel}
              className="rounded-md bg-neutral-100 px-2 py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-neutral-500"
            >
              {dayLabel}
            </div>
          ))}

          {loading
            ? Array.from({ length: Math.max(calendar.weeks.length * 7, 35) }).map((_, index) => (
                <div
                  key={`loading-${index}`}
                  className="min-h-[124px] rounded-xl border border-neutral-200/80 bg-neutral-50/80 p-2"
                >
                  <div className="h-4 w-10 rounded bg-neutral-200" />
                  <div className="mt-3 space-y-2">
                    <div className="h-10 rounded bg-neutral-200/80" />
                    <div className="h-10 rounded bg-neutral-200/60" />
                  </div>
                </div>
              ))
            : calendar.weeks.flat().map((date) => {
                const dateKey = toDateKey(date)
                const inMonth = dateKey.startsWith(calendar.monthStartKey.slice(0, 7))
                const dayAppointments = appointmentMap.get(dateKey) ?? []

                return (
                  <div
                    key={dateKey}
                    className={cn(
                      "min-h-[124px] rounded-xl border p-2",
                      inMonth
                        ? "border-neutral-200/80 bg-white"
                        : "border-neutral-200/60 bg-neutral-50/70"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          inMonth ? "text-neutral-900" : "text-neutral-400"
                        )}
                      >
                        {date.getDate()}
                      </span>
                      {dayAppointments.length > 0 ? (
                        <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-medium text-primary-700">
                          {dayAppointments.length}
                        </span>
                      ) : null}
                    </div>

                    {dayAppointments.length === 0 ? (
                      <p className="mt-4 text-[11px] text-neutral-400">
                        {inMonth ? t("appointments.monthBoardNoVisits", "No visits") : ""}
                      </p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {dayAppointments.slice(0, maxVisiblePerDay).map((appointment) => (
                          <div
                            key={appointment.id}
                            className="rounded-lg border border-neutral-200/80 bg-neutral-50 px-2 py-1.5"
                          >
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="font-medium text-neutral-700">
                                {formatAppointmentTime(appointment.scheduled_at)}
                              </span>
                              <span
                                className={cn(
                                  "h-2 w-2 rounded-full",
                                  STATUS_DOT_CLASS[appointment.status] ?? "bg-neutral-300"
                                )}
                                aria-hidden
                              />
                            </div>
                            <p className="mt-1 truncate text-[11px] font-medium text-neutral-900">
                              {appointment.patient_name ?? t("appointments.monthBoardPatient", "Patient")}
                            </p>
                            <p className="truncate text-[10px] text-neutral-500">
                              {providerLabel(appointment.provider_id, providerNames)} ·{" "}
                              {appointmentPurposeLabel(appointment)}
                            </p>
                          </div>
                        ))}

                        {dayAppointments.length > maxVisiblePerDay ? (
                          <p className="text-[10px] font-medium text-neutral-500">
                            +{dayAppointments.length - maxVisiblePerDay}{" "}
                            {t("appointments.monthBoardMore", "more appointments")}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                )
              })}
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-neutral-500">
        {t(
          "appointments.monthBoardFooter",
          "Use this board to see which days are packed, who is booked, and what kind of visit is coming before you switch into the full appointment scheduler."
        )}
      </p>
    </section>
  )
}
