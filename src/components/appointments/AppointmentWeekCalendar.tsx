"use client"

import * as React from "react"
import Link from "next/link"
import { Bell, Check, ChevronLeft, ChevronRight, UserCheck, UserX, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { AppointmentRecord } from "@/lib/appointments/appointment-service"
import {
  DAY_LABELS,
  appointmentDateKey,
  formatAppointmentTime,
  formatWeekRange,
  getWeekDays,
  parseDateKey,
  startOfWeekMonday,
  toDateKey,
  addDaysToKey,
  groupAppointmentsByDay,
} from "@/lib/appointments/week-calendar"

const DRAG_MIME = "application/x-dentali-appointment"
const MAX_VISIBLE_PER_DAY = 5

interface AppointmentWeekCalendarProps {
  appointments: AppointmentRecord[]
  weekStart: Date
  onWeekChange: (weekStart: Date) => void
  selectedDate: string
  onSelectDate: (dateKey: string) => void
  onStatusChange?: (id: string, status: string) => void
  onReschedule?: (id: string, targetDateKey: string) => void
  onCheckIn?: (id: string) => void
  onRemind?: (id: string) => void
  updatingId?: string | null
  reschedulingId?: string | null
  checkingInId?: string | null
  remindingId?: string | null
  dragHint?: string
}

export function AppointmentWeekCalendar({
  appointments,
  weekStart,
  onWeekChange,
  selectedDate,
  onSelectDate,
  onStatusChange,
  onReschedule,
  onCheckIn,
  onRemind,
  updatingId,
  reschedulingId,
  checkingInId,
  remindingId,
  dragHint,
}: AppointmentWeekCalendarProps) {
  const [dropTarget, setDropTarget] = React.useState<string | null>(null)
  const weekDays = React.useMemo(() => getWeekDays(weekStart), [weekStart])
  const grouped = React.useMemo(
    () => groupAppointmentsByDay(appointments, weekDays),
    [appointments, weekDays]
  )
  const todayKey = toDateKey(new Date())

  const selectedAppointments = grouped.get(selectedDate) ?? []
  const canReschedule = Boolean(onReschedule)

  const weekMaxAppointments = React.useMemo(() => {
    let max = 0
    for (const day of weekDays) {
      const count = (grouped.get(toDateKey(day)) ?? []).length
      if (count > max) max = count
    }
    return Math.max(max, 1)
  }, [weekDays, grouped])

  const heatmapClass = (count: number) => {
    if (count <= 0) return "border-neutral-200 bg-white"
    const ratio = count / weekMaxAppointments
    if (ratio >= 0.75) return "border-primary-300 bg-primary-100/80"
    if (ratio >= 0.5) return "border-primary-200 bg-primary-50/90"
    if (ratio >= 0.25) return "border-sky-200 bg-sky-50/70"
    return "border-neutral-200 bg-neutral-50/80"
  }

  const handleDragStart = (e: React.DragEvent, appt: AppointmentRecord) => {
    if (!canReschedule) return
    if (appt.status !== "scheduled" && appt.status !== "confirmed") {
      e.preventDefault()
      return
    }
    e.dataTransfer.setData(DRAG_MIME, appt.id)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent, dateKey: string) => {
    if (!canReschedule || !e.dataTransfer.types.includes(DRAG_MIME)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDropTarget(dateKey)
  }

  const handleDrop = (e: React.DragEvent, dateKey: string) => {
    e.preventDefault()
    setDropTarget(null)
    if (!onReschedule) return
    const id = e.dataTransfer.getData(DRAG_MIME)
    if (!id) return
    const appt = appointments.find((a) => a.id === id)
    if (!appt || appointmentDateKey(appt.scheduled_at) === dateKey) return
    onReschedule(id, dateKey)
  }

  const weekStartKey = toDateKey(weekStart)

  return (
    <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              onWeekChange(startOfWeekMonday(parseDateKey(addDaysToKey(weekStartKey, -7))))
            }
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => {
              const monday = startOfWeekMonday(new Date())
              onWeekChange(monday)
              onSelectDate(toDateKey(new Date()))
            }}
          >
            This week
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              onWeekChange(startOfWeekMonday(parseDateKey(addDaysToKey(weekStartKey, 7))))
            }
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <span className="text-sm font-semibold text-neutral-900">{formatWeekRange(weekStart)}</span>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {weekDays.map((day, i) => {
          const key = toDateKey(day)
          const dayAppts = grouped.get(key) ?? []
          const isSelected = key === selectedDate
          const isToday = key === todayKey
          const isDropTarget = dropTarget === key
          const dayNum = Number(key.slice(8, 10))

          return (
            <div
              key={key}
              onDragOver={(e) => handleDragOver(e, key)}
              onDragLeave={() => setDropTarget((prev) => (prev === key ? null : prev))}
              onDrop={(e) => handleDrop(e, key)}
              className={`rounded-lg border p-2 sm:p-3 min-h-[120px] sm:min-h-[140px] transition-colors ${
                isDropTarget
                  ? "border-primary-500 bg-primary-50 ring-2 ring-primary-200"
                  : isSelected
                    ? "border-primary-400 bg-primary-50/80 ring-1 ring-primary-200"
                    : heatmapClass(dayAppts.length)
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectDate(key)}
                className="w-full text-left mb-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs font-medium text-neutral-500 uppercase">
                    {DAY_LABELS[i]}
                  </span>
                  {isToday ? (
                    <span className="text-[10px] font-semibold text-primary-600">Today</span>
                  ) : null}
                </div>
                <div className="flex items-baseline justify-between gap-1">
                  <p className="text-sm font-bold text-neutral-900">{dayNum}</p>
                  {dayAppts.length > 0 ? (
                    <span className="text-[10px] font-semibold tabular-nums text-primary-700">
                      {dayAppts.length}
                    </span>
                  ) : null}
                </div>
              </button>
              <div className="space-y-1">
                {dayAppts.slice(0, MAX_VISIBLE_PER_DAY).map((appt) => {
                  const draggable =
                    canReschedule &&
                    (appt.status === "scheduled" || appt.status === "confirmed")
                  const patientLabel = appt.patient_name ?? "Patient"
                  return (
                    <div
                      key={appt.id}
                      draggable={draggable}
                      onDragStart={(e) => handleDragStart(e, appt)}
                      className={`rounded px-1.5 py-1 bg-white/90 border border-neutral-200/80 text-neutral-800 ${
                        draggable ? "cursor-grab active:cursor-grabbing hover:bg-white" : ""
                      } ${reschedulingId === appt.id ? "opacity-50" : ""}`}
                      title={[formatAppointmentTime(appt.scheduled_at), patientLabel, appt.purpose]
                        .filter(Boolean)
                        .join(" · ")}
                    >
                      <p className="text-[10px] sm:text-xs font-semibold tabular-nums text-primary-700">
                        {formatAppointmentTime(appt.scheduled_at)}
                      </p>
                      <p className="text-[10px] sm:text-xs truncate font-medium">
                        {patientLabel}
                      </p>
                    </div>
                  )
                })}
                {dayAppts.length > MAX_VISIBLE_PER_DAY ? (
                  <button
                    type="button"
                    onClick={() => onSelectDate(key)}
                    className="text-[10px] text-primary-600 hover:underline"
                  >
                    +{dayAppts.length - MAX_VISIBLE_PER_DAY} more
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-4">
        <h3 className="text-sm font-semibold text-neutral-900 mb-1">
          {parseDateKey(selectedDate).toLocaleDateString("en-PH", {
            weekday: "long",
            month: "long",
            day: "numeric",
            timeZone: "Asia/Manila",
          })}
        </h3>
        <p className="text-xs text-neutral-500 mb-3">
          {selectedAppointments.length === 0
            ? "No appointments"
            : `${selectedAppointments.length} appointment${selectedAppointments.length === 1 ? "" : "s"}`}
        </p>
        {selectedAppointments.length === 0 ? (
          <p className="text-sm text-neutral-500">Select another day or book a new visit.</p>
        ) : (
          <ul className="space-y-2">
            {selectedAppointments.map((appt) => {
              const draggable =
                canReschedule &&
                (appt.status === "scheduled" || appt.status === "confirmed")
              const isActive = appt.status === "scheduled" || appt.status === "confirmed"
              return (
                <li
                  key={appt.id}
                  draggable={draggable}
                  onDragStart={(e) => handleDragStart(e, appt)}
                  className={`rounded-lg border border-neutral-200 bg-white p-3 ${
                    draggable ? "cursor-grab active:cursor-grabbing hover:border-neutral-300" : ""
                  } ${reschedulingId === appt.id ? "opacity-50" : ""}`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-sm text-neutral-900">
                        {formatAppointmentTime(appt.scheduled_at)}
                        <span className="mx-2 text-neutral-300">·</span>
                        <Link href={`/patients/${appt.patient_id}`} className="text-primary-600 hover:underline">
                          {appt.patient_name ?? appt.patient_id.slice(0, 8)}
                        </Link>
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">{appt.purpose ?? "Appointment"}</p>
                    </div>
                    <Badge
                      variant={
                        appt.status === "completed"
                          ? "success"
                          : appt.status === "cancelled" || appt.status === "no_show"
                            ? "outline"
                            : "info"
                      }
                    >
                      {appt.status === "no_show" ? "No-show" : appt.status}
                    </Badge>
                  </div>
                  {isActive && onStatusChange ? (
                    <div className="mt-3 flex flex-wrap gap-1 border-t border-neutral-100 pt-3">
                      {onRemind ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1"
                          disabled={remindingId === appt.id}
                          onClick={() => onRemind(appt.id)}
                        >
                          <Bell className="h-3.5 w-3.5" />
                          Remind
                        </Button>
                      ) : null}
                      {onCheckIn ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1"
                          disabled={checkingInId === appt.id}
                          onClick={() => onCheckIn(appt.id)}
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          Check in
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1"
                        disabled={updatingId === appt.id || reschedulingId === appt.id}
                        onClick={() => onStatusChange(appt.id, "completed")}
                      >
                        <Check className="h-3.5 w-3.5 text-success-600" />
                        Done
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1"
                        disabled={updatingId === appt.id || reschedulingId === appt.id}
                        onClick={() => onStatusChange(appt.id, "no_show")}
                      >
                        <UserX className="h-3.5 w-3.5" />
                        No-show
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1"
                        disabled={updatingId === appt.id || reschedulingId === appt.id}
                        onClick={() => onStatusChange(appt.id, "cancelled")}
                      >
                        <X className="h-3.5 w-3.5" />
                        Cancel
                      </Button>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
        {canReschedule && dragHint ? (
          <p className="mt-4 text-xs text-neutral-400">{dragHint}</p>
        ) : null}
      </div>
    </div>
  )
}
