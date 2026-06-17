"use client"

import * as React from "react"
import Link from "next/link"
import { Bell, Check, ChevronLeft, ChevronRight, UserCheck, UserX, X, Calendar, Filter, Plus, List, LayoutGrid } from "lucide-react"
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
  addDays,
} from "@/lib/appointments/week-calendar"
import { cn } from "@/lib/utils"
import type { StaffMember } from "@/lib/staff/staff-service"
import { useLocale } from "@/hooks/use-locale"
import { AppointmentBookingBadge } from "@/components/appointments/AppointmentBookingBadge"

const DRAG_MIME = "application/x-dentali-appointment"

interface AppointmentWeekCalendarProps {
  appointments: AppointmentRecord[]
  weekStart: Date
  onWeekChange: (weekStart: Date) => void
  selectedDate: string
  onSelectDate: (dateKey: string) => void
  onStatusChange?: (id: string, status: string) => void
  onReschedule?: (id: string, targetDateKey: string) => void
  onCheckIn?: (appointment: AppointmentRecord) => void
  checkingInId?: string | null
  onRemind?: (id: string) => void
  onEdit?: (appointment: AppointmentRecord) => void
  updatingId?: string | null
  reschedulingId?: string | null
  remindingId?: string | null
  dragHint?: string
  providers: StaffMember[]
  /** When false (default), completed visits must go through Queue → Served. */
  allowDirectComplete?: boolean
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
  checkingInId,
  onRemind,
  onEdit,
  updatingId,
  reschedulingId,
  remindingId,
  dragHint,
  providers,
  allowDirectComplete = false,
}: AppointmentWeekCalendarProps) {
  const { t } = useLocale()
  const [viewMode, setViewMode] = React.useState<"month" | "week" | "day">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dentali-calendar-viewmode")
      if (saved === "month" || saved === "week" || saved === "day") {
        return saved
      }
    }
    return "month"
  })

  const handleViewModeChange = (mode: "month" | "week" | "day") => {
    setViewMode(mode)
    if (typeof window !== "undefined") {
      localStorage.setItem("dentali-calendar-viewmode", mode)
    }
  }

  const [filterProviderId, setFilterProviderId] = React.useState<string>("all")
  const [dropTarget, setDropTarget] = React.useState<string | null>(null)
  
  const todayKey = toDateKey(new Date())

  // Filter appointments by selected dentist
  const filteredAppointments = React.useMemo(() => {
    if (filterProviderId === "all") return appointments
    return appointments.filter((a) => a.provider_id === filterProviderId)
  }, [appointments, filterProviderId])

  // Get week days based on weekStart
  const weekDays = React.useMemo(() => getWeekDays(weekStart), [weekStart])

  // Month grid calculations
  const monthStart = React.useMemo(() => {
    const d = parseDateKey(selectedDate)
    return new Date(d.getFullYear(), d.getMonth(), 1)
  }, [selectedDate])

  const monthDays = React.useMemo(() => {
    const firstMonday = startOfWeekMonday(monthStart)
    const days: Date[] = []
    for (let i = 0; i < 35; i++) {
      days.push(addDays(firstMonday, i))
    }
    // If month ends after the 35th day grid, render 42 days grid
    const lastDayOfMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
    if (toDateKey(days[34]) < toDateKey(lastDayOfMonth)) {
      for (let i = 35; i < 42; i++) {
        days.push(addDays(firstMonday, i))
      }
    }
    return days
  }, [monthStart])

  // Group filtered appointments by day keys
  const groupedAppointments = React.useMemo(() => {
    const map = new Map<string, AppointmentRecord[]>()
    for (const appt of filteredAppointments) {
      const key = appointmentDateKey(appt.scheduled_at)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(appt)
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
    }
    return map
  }, [filteredAppointments])

  const selectedAppointments = React.useMemo(() => {
    return groupedAppointments.get(selectedDate) ?? []
  }, [groupedAppointments, selectedDate])

  const canReschedule = Boolean(onReschedule)

  // Drag and drop handlers
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

  // Navigation handlers
  const handleNavigate = (direction: -1 | 1) => {
    if (viewMode === "month") {
      const nextMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + direction, 1)
      onWeekChange(startOfWeekMonday(nextMonth))
      onSelectDate(toDateKey(nextMonth))
    } else if (viewMode === "week") {
      const nextWeekStart = startOfWeekMonday(parseDateKey(addDaysToKey(toDateKey(weekStart), direction * 7)))
      onWeekChange(nextWeekStart)
      onSelectDate(toDateKey(nextWeekStart))
    } else {
      const nextDay = addDaysToKey(selectedDate, direction)
      onSelectDate(nextDay)
      // If next day is outside the current week grid, adjust weekStart
      const nextDayDate = parseDateKey(nextDay)
      if (toDateKey(nextDayDate) < toDateKey(weekDays[0]) || toDateKey(nextDayDate) > toDateKey(weekDays[6])) {
        onWeekChange(startOfWeekMonday(nextDayDate))
      }
    }
  }

  const handleGoToday = () => {
    const today = new Date()
    onSelectDate(toDateKey(today))
    onWeekChange(startOfWeekMonday(today))
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-50 text-emerald-700 border-emerald-200"
      case "cancelled":
        return "bg-neutral-50 text-neutral-400 border-neutral-200 line-through"
      case "no_show":
        return "bg-amber-50 text-amber-700 border-amber-200"
      default:
        return "bg-blue-50 text-blue-700 border-blue-200"
    }
  }

  const getStatusDotColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-emerald-500"
      case "cancelled": return "bg-neutral-300"
      case "no_show": return "bg-amber-500"
      default: return "bg-blue-500"
    }
  }

  const formatHeaderRange = () => {
    if (viewMode === "month") {
      return monthStart.toLocaleDateString("en-PH", { month: "long", year: "numeric" })
    } else if (viewMode === "week") {
      return formatWeekRange(weekStart)
    } else {
      return parseDateKey(selectedDate).toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm">
      
      {/* Notion-Style Top Menu & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-neutral-100 gap-4">
        
        {/* View Mode Tabs */}
        <div className="flex items-center space-x-1 bg-neutral-100/80 p-0.5 rounded-lg w-fit">
          {(["month", "week", "day"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => handleViewModeChange(mode)}
              className={cn(
                "px-3 py-1 text-xs font-semibold rounded-md transition-all uppercase tracking-wider",
                viewMode === mode
                  ? "bg-white text-neutral-800 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-800"
              )}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Date Navigator */}
        <div className="flex items-center justify-center space-x-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleNavigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 font-medium text-xs px-3" onClick={handleGoToday}>
            Today
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleNavigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-bold text-neutral-800 px-2">{formatHeaderRange()}</span>
        </div>

        {/* Dentist/Provider Filter */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-neutral-400 font-medium flex items-center gap-1">
            <Filter className="h-3 w-3" /> Dentist:
          </span>
          <select
            value={filterProviderId}
            onChange={(e) => setFilterProviderId(e.target.value)}
            className="h-8 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="all">All Dentists</option>
            {providers.map((p) => (
              <option key={p.profile_id} value={p.profile_id}>
                {p.full_name ?? p.email}
              </option>
            ))}
          </select>
        </div>

      </div>

      {/* Monthly Grid View */}
      {viewMode === "month" && (
        <div className="-mx-1 overflow-x-auto scroll-px-2 pb-1 snap-x snap-mandatory [scrollbar-width:thin] md:mx-0 md:overflow-visible md:snap-none">
          <div className="min-w-[680px] border border-neutral-200 rounded-lg md:min-w-0">
          <div className="grid grid-cols-7 gap-px overflow-hidden bg-neutral-200">
          {/* Weekday labels */}
          {DAY_LABELS.map((label) => (
            <div key={label} className="bg-neutral-50 p-2 text-center text-[10px] font-bold text-neutral-500 uppercase">
              {label}
            </div>
          ))}
          
          {/* Day Grid Cells */}
          {monthDays.map((day) => {
            const key = toDateKey(day)
            const dayAppts = groupedAppointments.get(key) ?? []
            const isSelected = key === selectedDate
            const isToday = key === todayKey
            const isCurrentMonth = day.getMonth() === monthStart.getMonth()

            return (
              <div
                key={key}
                onDragOver={(e) => handleDragOver(e, key)}
                onDragLeave={() => setDropTarget((prev) => (prev === key ? null : prev))}
                onDrop={(e) => handleDrop(e, key)}
                onClick={() => onSelectDate(key)}
                className={cn(
                  "bg-white p-2 min-h-[90px] cursor-pointer transition-all relative hover:bg-neutral-50/50 flex flex-col justify-between",
                  !isCurrentMonth && "bg-neutral-50/30 text-neutral-400",
                  isSelected && "ring-1 ring-primary-500 bg-primary-50/10 z-10",
                  dropTarget === key && "bg-primary-50 ring-2 ring-primary-300"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={cn(
                    "text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center",
                    isToday && "bg-primary-600 text-white",
                    !isToday && isCurrentMonth && "text-neutral-700",
                    !isToday && !isCurrentMonth && "text-neutral-400"
                  )}>
                    {day.getDate()}
                  </span>
                  {dayAppts.length > 0 && (
                    <span className="text-[9px] font-bold text-neutral-400">
                      {dayAppts.length} visit{dayAppts.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                <div className="space-y-1 overflow-hidden flex-1">
                  {dayAppts.slice(0, 3).map((appt) => {
                    const draggable = canReschedule && (appt.status === "scheduled" || appt.status === "confirmed")
                    return (
                      <div
                        key={appt.id}
                        draggable={draggable}
                        onDragStart={(e) => {
                          e.stopPropagation()
                          handleDragStart(e, appt)
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          onEdit?.(appt)
                        }}
                        className={cn(
                          "text-[9px] font-medium px-1 py-0.5 rounded border flex items-center justify-between gap-1",
                          getStatusColor(appt.status),
                          draggable && "cursor-grab active:cursor-grabbing hover:border-neutral-300"
                        )}
                      >
                        <span className="truncate">{appt.patient_name ?? "Patient"}</span>
                        <span className="shrink-0 text-neutral-400">{formatAppointmentTime(appt.scheduled_at)}</span>
                      </div>
                    )
                  })}
                  {dayAppts.length > 3 && (
                    <p className="text-[9px] text-primary-600 font-semibold pl-1">
                      +{dayAppts.length - 3} more
                    </p>
                  )}
                </div>
              </div>
            )
          })}
          </div>
          </div>
        </div>
      )}

      {/* Weekly Grid View */}
      {viewMode === "week" && (
        <div className="-mx-1 overflow-x-auto scroll-px-2 pb-1 snap-x snap-mandatory [scrollbar-width:thin] md:mx-0 md:overflow-visible md:snap-none">
          <div className="grid min-w-[640px] grid-cols-7 gap-1 md:min-w-0 md:gap-2">
          {weekDays.map((day, i) => {
            const key = toDateKey(day)
            const dayAppts = groupedAppointments.get(key) ?? []
            const isSelected = key === selectedDate
            const isToday = key === todayKey
            const isDropTarget = dropTarget === key

            return (
              <div
                key={key}
                onDragOver={(e) => handleDragOver(e, key)}
                onDragLeave={() => setDropTarget((prev) => (prev === key ? null : prev))}
                onDrop={(e) => handleDrop(e, key)}
                onClick={() => onSelectDate(key)}
                className={cn(
                  "rounded-lg border p-3 min-h-[140px] cursor-pointer transition-all flex flex-col justify-between",
                  isDropTarget
                    ? "border-primary-500 bg-primary-50 ring-2 ring-primary-200"
                    : isSelected
                      ? "border-primary-400 bg-primary-50/80 ring-1 ring-primary-200"
                      : "border-neutral-200 bg-white hover:bg-neutral-50/50"
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase">
                      {DAY_LABELS[i]}
                    </span>
                    {isToday && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-primary-50 text-primary-700 rounded-full">
                        Today
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm font-extrabold text-neutral-800">{day.getDate()}</p>
                    {dayAppts.length > 0 && (
                      <span className="text-[10px] font-extrabold text-primary-600 bg-primary-50 rounded-full px-1.5">
                        {dayAppts.length}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 mt-3 flex-1">
                  {dayAppts.slice(0, 4).map((appt) => {
                    const draggable = canReschedule && (appt.status === "scheduled" || appt.status === "confirmed")
                    return (
                      <div
                        key={appt.id}
                        draggable={draggable}
                        onDragStart={(e) => {
                          e.stopPropagation()
                          handleDragStart(e, appt)
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          onEdit?.(appt)
                        }}
                        className={cn(
                          "rounded p-1.5 border text-left text-[10px] flex flex-col gap-0.5 shadow-sm bg-white/95",
                          reschedulingId === appt.id && "opacity-50",
                          draggable && "cursor-grab active:cursor-grabbing hover:border-neutral-300"
                        )}
                        title={`${formatAppointmentTime(appt.scheduled_at)} · ${appt.patient_name}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-neutral-800">
                            {formatAppointmentTime(appt.scheduled_at)}
                          </span>
                          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", getStatusDotColor(appt.status))} />
                        </div>
                        <span className="truncate font-semibold text-neutral-600">
                          {appt.patient_name ?? "Patient"}
                        </span>
                      </div>
                    )
                  })}
                  {dayAppts.length > 4 && (
                    <button className="text-[10px] text-primary-600 font-bold hover:underline">
                      +{dayAppts.length - 4} more
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          </div>
        </div>
      )}

      {/* Daily View Timeline Grid */}
      {viewMode === "day" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Timeline View (Left 2 Columns) */}
          <div className="md:col-span-2 space-y-2 border border-neutral-100 rounded-xl p-4 bg-neutral-50/50">
            <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Visits Timeline</h4>
            {selectedAppointments.length === 0 ? (
              <div className="py-12 text-center text-neutral-400">
                <Calendar className="mx-auto h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">No appointments scheduled for this day.</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-200/60">
                {selectedAppointments.map((appt) => {
                  const provider = providers.find((p) => p.profile_id === appt.provider_id)
                  return (
                    <div
                      key={appt.id}
                      onClick={() => onSelectDate(appointmentDateKey(appt.scheduled_at))}
                      className="py-3 flex items-center justify-between hover:bg-white/50 px-2 rounded-lg transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className={cn("px-2 py-1 rounded text-xs font-bold border", getStatusColor(appt.status))}>
                          {formatAppointmentTime(appt.scheduled_at)}
                        </div>
                        <div>
                          <Link href={`/patients/${appt.patient_id}`} className="font-bold text-sm text-neutral-800 hover:underline">
                            {appt.patient_name ?? "Patient"}
                          </Link>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[11px] text-neutral-500">{appt.purpose ?? "General Checkup"}</span>
                            <AppointmentBookingBadge appointment={appt} className="text-[9px] px-1.5 py-0" />
                            {provider && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-neutral-100 text-neutral-600 rounded">
                            Dr. {provider.full_name?.split(" ")[1] ?? provider.email?.split("@")[0] ?? "Dentist"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Badge className={cn("border select-none", getStatusColor(appt.status))}>
                          {appt.status}
                        </Badge>
                        
                        {(appt.status === "scheduled" || appt.status === "confirmed") && onStatusChange && (
                          <div className="flex items-center gap-1">
                            {onEdit && (
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => onEdit(appt)}
                                title={t("appointments.editAppointment", "Edit / Reschedule")}
                              >
                                <Calendar className="h-4 w-4" />
                              </Button>
                            )}
                            {onRemind && (
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 text-neutral-500 hover:text-neutral-700"
                                disabled={remindingId === appt.id}
                                onClick={() => onRemind(appt.id)}
                                title="Send Reminder"
                              >
                                <Bell className="h-4 w-4" />
                              </Button>
                            )}
                            {onCheckIn &&
                            (appt.status === "scheduled" || appt.status === "confirmed") ? (
                              <Button
                                size="sm"
                                className="h-8 gap-1.5 bg-primary-600 px-3 text-white hover:bg-primary-700"
                                disabled={checkingInId === appt.id}
                                onClick={() => onCheckIn(appt)}
                              >
                                <UserCheck className="h-3.5 w-3.5" />
                                {checkingInId === appt.id
                                  ? t("appointments.checkingIn", "Checking in…")
                                  : t("appointments.checkInBtn", "Check in")}
                              </Button>
                            ) : null}
                            {allowDirectComplete ? (
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              disabled={updatingId === appt.id}
                              onClick={() => onStatusChange(appt.id, "completed")}
                              title="Mark Done"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1 px-2 text-primary-700"
                              asChild
                            >
                              <Link href="/queue" title={t("appointments.openQueueCheckIn", "Open Queue to check in")}>
                                <UserCheck className="h-3.5 w-3.5" />
                                {t("queue.title", "Queue")}
                              </Link>
                            </Button>
                            )}
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                              disabled={updatingId === appt.id}
                              onClick={() => onStatusChange(appt.id, "no_show")}
                              title="Mark No-Show"
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                              disabled={updatingId === appt.id}
                              onClick={() => onStatusChange(appt.id, "cancelled")}
                              title="Cancel Appointment"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quick Details Panel (Right 1 Column) */}
          <div className="border border-neutral-100 rounded-xl p-4 bg-neutral-50/30">
            <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Selected Day Summary</h4>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-neutral-400 font-medium">Date Selected</p>
                <p className="text-sm font-bold text-neutral-700">
                  {parseDateKey(selectedDate).toLocaleDateString("en-PH", { weekday: "long", month: "short", day: "numeric" })}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 bg-white p-3 rounded-lg border border-neutral-100">
                <div>
                  <p className="text-[10px] text-neutral-400">Total Bookings</p>
                  <p className="text-lg font-extrabold text-neutral-800">{selectedAppointments.length}</p>
                </div>
                <div>
                  <p className="text-[10px] text-neutral-400">Completed</p>
                  <p className="text-lg font-extrabold text-emerald-600">
                    {selectedAppointments.filter((a) => a.status === "completed").length}
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Selected Day Visits Panel for Month/Week views */}
      {viewMode !== "day" && (
        <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-neutral-200/80 mb-4 gap-2">
            <div>
              <h3 className="text-sm font-bold text-neutral-800">
                {parseDateKey(selectedDate).toLocaleDateString("en-PH", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "Asia/Manila",
                })}
              </h3>
              <p className="text-xs text-neutral-400 font-medium mt-0.5">
                {selectedAppointments.length === 0
                  ? "No appointments"
                  : `${selectedAppointments.length} appointment${selectedAppointments.length === 1 ? "" : "s"} scheduled`}
              </p>
            </div>
          </div>

          {selectedAppointments.length === 0 ? (
            <p className="text-sm text-neutral-500">Select another day or click "Book" above to add an appointment.</p>
          ) : (
            <ul className="space-y-2">
              {selectedAppointments.map((appt) => {
                const draggable = canReschedule && (appt.status === "scheduled" || appt.status === "confirmed")
                const isActive = appt.status === "scheduled" || appt.status === "confirmed"
                const provider = providers.find((p) => p.profile_id === appt.provider_id)
                
                return (
                  <li
                    key={appt.id}
                    draggable={draggable}
                    onDragStart={(e) => handleDragStart(e, appt)}
                    onDoubleClick={() => onEdit?.(appt)}
                    className={cn(
                      "rounded-lg border border-neutral-200 bg-white p-3.5 transition-all shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4",
                      draggable && "cursor-grab active:cursor-grabbing hover:border-neutral-300",
                      reschedulingId === appt.id && "opacity-50"
                    )}
                  >
                    <div className="flex items-start gap-3 flex-1">
                      <div className={cn("px-2.5 py-1 rounded text-xs font-bold border shrink-0 text-center min-w-[65px]", getStatusColor(appt.status))}>
                        {formatAppointmentTime(appt.scheduled_at)}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/patients/${appt.patient_id}`} className="font-extrabold text-sm text-primary-600 hover:underline">
                            {appt.patient_name ?? appt.patient_id.slice(0, 8)}
                          </Link>
                          <AppointmentBookingBadge appointment={appt} className="text-[9px] px-1.5 py-0" />
                          {provider && (
                            <Badge variant="outline" className="text-[10px] font-semibold">
                              Dr. {provider.full_name ?? provider.email?.split("@")[0] ?? "Dentist"}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-neutral-500">{appt.purpose ?? "General checkup"}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                      <Badge className={cn("border uppercase font-semibold text-[10px] select-none", getStatusColor(appt.status))}>
                        {appt.status}
                      </Badge>

                      {appt.status === "checked_in" && onCheckIn ? (
                        <Button size="sm" variant="outline" className="h-8" asChild>
                          <Link href="/queue">{t("appointments.openQueue", "Open queue")}</Link>
                        </Button>
                      ) : null}
                      
                      {isActive && onStatusChange && (
                        <div className="flex items-center gap-1">
                          {onEdit && (
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => onEdit(appt)}
                              title={t("appointments.editAppointment", "Edit / Reschedule")}
                            >
                              <Calendar className="h-4 w-4" />
                            </Button>
                          )}
                          {onRemind && (
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 text-neutral-500 hover:text-neutral-700"
                              disabled={remindingId === appt.id}
                              onClick={() => onRemind(appt.id)}
                              title="Send Reminder"
                            >
                              <Bell className="h-4 w-4" />
                            </Button>
                          )}
                          {onCheckIn &&
                          (appt.status === "scheduled" || appt.status === "confirmed") ? (
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 text-primary-600 hover:text-primary-700 hover:bg-primary-50"
                              disabled={checkingInId === appt.id}
                              onClick={() => onCheckIn(appt)}
                              title={t("appointments.checkInBtn", "Check in")}
                            >
                              <UserCheck className="h-4 w-4" />
                            </Button>
                          ) : null}
                          {allowDirectComplete ? (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            disabled={updatingId === appt.id}
                            onClick={() => onStatusChange(appt.id, "completed")}
                            title="Mark Done"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          ) : (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-primary-600 hover:text-primary-700 hover:bg-primary-50"
                            asChild
                            title={t("appointments.openQueueCheckIn", "Open Queue to check in")}
                          >
                            <Link href="/queue">
                              <UserCheck className="h-4 w-4" />
                            </Link>
                          </Button>
                          )}
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            disabled={updatingId === appt.id}
                            onClick={() => onStatusChange(appt.id, "no_show")}
                            title="Mark No-Show"
                          >
                            <UserX className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                            disabled={updatingId === appt.id}
                            onClick={() => onStatusChange(appt.id, "cancelled")}
                            title="Cancel Appointment"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          
          {canReschedule && dragHint && (
            <div className="mt-4 flex flex-col gap-1.5 border-t border-neutral-100 pt-3">
              <p className="text-xs text-neutral-400">{dragHint}</p>
              <p className="text-xs text-primary-500 font-semibold flex items-center gap-1">
                💡 {t("appointments.monthDragRecommendation", "For the best drag-and-drop rescheduling experience, switch to Month view.")}
              </p>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
