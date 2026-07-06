"use client"

import * as React from "react"
import Link from "next/link"
import { Megaphone, Undo2, GripVertical, UserCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/use-locale"
import type { AppointmentRecord } from "@/lib/appointments/types"
import { formatArrivalTime } from "@/lib/queue/appointment-arrival"
import {
  reorderQueueBoard,
  waitMinutes,
  type QueueEntry,
  type QueueStatus,
} from "@/lib/queue/queue-service"
import { isPriorClinicDay } from "@/lib/queue/queue-day"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

type BoardColumn = {
  id: "arrivals" | "waiting" | "serving" | "chair"
  titleKey: string
  titleDefault: string
  statuses: QueueStatus[]
  dropStatus: QueueStatus | null
  borderClass: string
  canReorder: boolean
}

const BOARD_COLUMNS: BoardColumn[] = [
  {
    id: "arrivals",
    titleKey: "queue.colArrivals",
    titleDefault: "Check-in",
    statuses: [],
    dropStatus: null,
    borderClass: "border-t-2 border-t-violet-500 bg-violet-50/20",
    canReorder: false,
  },
  {
    id: "waiting",
    titleKey: "queue.colWaiting",
    titleDefault: "Waiting",
    statuses: ["waiting", "ready"],
    dropStatus: "waiting",
    borderClass: "border-t-2 border-t-amber-500 bg-white",
    canReorder: true,
  },
  {
    id: "serving",
    titleKey: "queue.colServing",
    titleDefault: "Called",
    statuses: ["now_serving"],
    dropStatus: "now_serving",
    borderClass: "border-t-2 border-t-blue-500 bg-white",
    canReorder: false,
  },
  {
    id: "chair",
    titleKey: "queue.colChair",
    titleDefault: "In Chair",
    statuses: ["in_chair"],
    dropStatus: "in_chair",
    borderClass: "border-t-2 border-t-emerald-500 bg-white",
    canReorder: false,
  },
]

export type QueueBoardArrival = {
  appointment: AppointmentRecord
  tone: "overdue" | "due" | "upcoming"
  minutesUntil: number
}

function ArrivalCardInner({
  appt,
  tone,
  minutesUntil,
  checkingIn,
  highlighted,
  onCheckIn,
  readOnly = false,
}: {
  appt: AppointmentRecord
  tone: "overdue" | "due" | "upcoming"
  minutesUntil: number
  checkingIn: boolean
  highlighted?: boolean
  onCheckIn: () => void
  readOnly?: boolean
}) {
  const { t } = useLocale()
  const timingLabel =
    tone === "overdue"
      ? t("queue.arrivalLate", "{n} min late").replace("{n}", String(Math.abs(minutesUntil)))
      : tone === "due"
        ? t("queue.arrivalDue", "Due now")
        : t("queue.arrivalIn", "In {n} min").replace("{n}", String(minutesUntil))

  return (
    <div
      className={cn(
        "rounded-lg border bg-white p-3 shadow-sm border-l-4",
        tone === "overdue" && "border-l-red-500 border-y-red-100 border-r-red-100",
        tone === "due" && "border-l-amber-500 border-y-amber-100 border-r-amber-100",
        tone === "upcoming" && "border-l-violet-400 border-y-neutral-200 border-r-neutral-200",
        highlighted && "ring-2 ring-primary-400 ring-offset-1"
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-semibold tabular-nums text-neutral-800">
          {formatArrivalTime(appt.scheduled_at)}
        </span>
        <Badge
          variant={tone === "overdue" ? "danger" : tone === "due" ? "warning" : "outline"}
          className="text-[10px]"
        >
          {timingLabel}
        </Badge>
      </div>
      <Link
        href={`/patients/${appt.patient_id}`}
        className="mt-1 block truncate text-sm font-medium text-neutral-900 hover:underline"
      >
        {appt.patient_name ?? t("dentist.unknownPatient", "Patient")}
      </Link>
      {appt.purpose ? (
        <p className="mt-0.5 truncate text-xs text-neutral-500">{appt.purpose}</p>
      ) : null}
      {!readOnly ? (
      <Button
        size="sm"
        className="mt-2 w-full gap-1"
        disabled={checkingIn}
        onClick={onCheckIn}
      >
        <UserCheck className="h-3.5 w-3.5" />
        {checkingIn
          ? t("queue.checkingIn", "Checking in...")
          : t("queue.checkInToWaiting", "Check in to Waiting")}
      </Button>
      ) : null}
    </div>
  )
}

function QueueCard({
  entry,
  onAction,
  loading,
  draggable,
  onDragStart,
  onDragEnd,
  isDragging,
  readOnly = false,
  staffMap = {},
}: {
  entry: QueueEntry
  onAction: (status: QueueStatus | "announce", chair?: string) => void
  loading: boolean
  draggable: boolean
  onDragStart: () => void
  onDragEnd: () => void
  isDragging: boolean
  readOnly?: boolean
  staffMap?: Record<string, string>
}) {
  const mins = waitMinutes(entry.checked_in_at)
  const { t } = useLocale()
  const isStaleActive = isPriorClinicDay(entry.checked_in_at)

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/queue-entry-id", entry.id)
        e.dataTransfer.effectAllowed = "move"
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "rounded-lg border bg-white p-3 shadow-sm border-l-4 transition-all",
        isStaleActive
          ? "border-l-amber-500 border-y-amber-200 border-r-amber-200 bg-amber-50/50 hover:bg-amber-50/70"
          : entry.appointment_id
            ? "border-l-blue-500 border-y-neutral-200 border-r-neutral-200 bg-blue-50/10 hover:bg-blue-50/20"
            : "border-l-neutral-400 border-y-neutral-200 border-r-neutral-200 hover:bg-neutral-50/50",
        isDragging && "opacity-50 ring-2 ring-primary-300",
        draggable && "cursor-grab active:cursor-grabbing"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-1.5 min-w-0">
          {draggable ? (
            <GripVertical className="h-4 w-4 text-neutral-300 shrink-0 mt-0.5" aria-hidden />
          ) : null}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-lg font-bold text-primary-700">{entry.display_code}</span>
              {entry.patient_mood === "anxious" ? (
                <span title="Patient is a bit anxious" className="text-xl cursor-help animate-pulse">
                  😰
                </span>
              ) : null}
              {entry.patient_mood === "normal" ? (
                <span title="Patient feels normal" className="text-xl cursor-help">
                  😐
                </span>
              ) : null}
              {entry.patient_mood === "great" ? (
                <span title="Patient is feeling great" className="text-xl cursor-help">
                  😊
                </span>
              ) : null}
              {entry.appointment_id ? (
                <Badge variant="outline" className="text-[10px] border-blue-200 bg-blue-50 text-blue-700 font-semibold">
                  {t("queue.scheduledAppt", "Scheduled")}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] border-neutral-200 bg-neutral-50 text-neutral-500 font-medium">
                  {t("queue.walkIn", "Walk-in")}
                </Badge>
              )}
              {isStaleActive ? (
                <Badge variant="warning" className="text-[10px] font-semibold">
                  {t("queue.priorDayOpen", "Prior day open")}
                </Badge>
              ) : null}
            </div>
            <Link href={`/patients/${entry.patient_id}`} className="block text-sm font-medium text-neutral-900 hover:underline truncate">
              {entry.patient_name ?? "Patient"}
            </Link>
          </div>
        </div>
        <Badge variant={entry.status === "ready" ? "info" : "warning"}>{entry.status.replace("_", " ")}</Badge>
      </div>
      <p className="text-xs text-neutral-500 mt-1">{mins} min waiting</p>
      {isStaleActive ? (
        <p className="mt-1 rounded-md border border-amber-200 bg-white/70 px-2 py-1 text-xs text-amber-900">
          {t(
            "queue.priorDayOpenHint",
            "Review this old active queue entry: continue care or cancel/complete it before closing the day."
          )}
        </p>
      ) : null}
      {(entry.chair_label || (entry.provider_id && staffMap[entry.provider_id])) ? (
        <p className="text-xs text-neutral-600 mt-1 font-medium bg-neutral-50 border border-neutral-100 rounded px-2 py-1 flex items-center gap-1.5 w-fit">
          {entry.chair_label ? <span>Chair: <span className="text-neutral-900 font-semibold">{entry.chair_label}</span></span> : null}
          {entry.chair_label && entry.provider_id && staffMap[entry.provider_id] ? <span className="text-neutral-300">·</span> : null}
          {entry.provider_id && staffMap[entry.provider_id] ? (
            <span>Dentist: <span className="text-neutral-900 font-semibold">{staffMap[entry.provider_id]}</span></span>
          ) : null}
        </p>
      ) : null}
      {entry.notes ? <p className="text-xs text-neutral-400 mt-1 truncate">{entry.notes}</p> : null}
      {!readOnly ? (
      <div className="flex flex-wrap gap-1 mt-2">
        {entry.status === "waiting" ? (
          <Button size="sm" variant="outline" disabled={loading} onClick={() => onAction("ready")}>
            {t("queue.markReady", "Mark ready")}
          </Button>
        ) : null}
        {entry.status === "ready" ? (
          <Button size="sm" variant="ghost" disabled={loading} onClick={() => onAction("waiting")} className="gap-1">
            <Undo2 className="h-3.5 w-3.5" />
            {t("queue.backToWaiting", "Back to waiting")}
          </Button>
        ) : null}
        {entry.status === "waiting" || entry.status === "ready" ? (
          <Button size="sm" variant="outline" disabled={loading} onClick={() => onAction("now_serving")}>
            {t("queue.callPatient", "Call")}
          </Button>
        ) : null}
        {entry.status === "now_serving" ? (
          <>
            <Button size="sm" variant="ghost" disabled={loading} onClick={() => onAction("waiting")} className="gap-1">
              <Undo2 className="h-3.5 w-3.5" />
              {t("queue.backToWaiting", "Back to waiting")}
            </Button>
            <Button size="sm" variant="outline" disabled={loading} onClick={() => onAction("announce")}>
              <Megaphone className="h-3.5 w-3.5 mr-1.5" />
              {t("queue.announce", "Announce")}
            </Button>
            <Button size="sm" disabled={loading} onClick={() => onAction("in_chair")}>
              {t("queue.toChair", "In chair")}
            </Button>
          </>
        ) : null}
        {entry.status === "in_chair" ? (
          <>
            <Button size="sm" variant="ghost" disabled={loading} onClick={() => onAction("now_serving")} className="gap-1">
              <Undo2 className="h-3.5 w-3.5" />
              {t("queue.backToCall", "Back to call area")}
            </Button>
            <Button size="sm" variant="outline" disabled={loading} onClick={() => onAction("waiting")} className="gap-1">
              <Undo2 className="h-3.5 w-3.5" />
              {t("queue.backToWaiting", "Back to waiting")}
            </Button>
            <Button size="sm" variant="default" disabled={loading} onClick={() => onAction("served")}>
              {t("queue.complete", "Complete")}
            </Button>
          </>
        ) : null}
        {entry.status !== "served" ? (
          <Button size="sm" variant="ghost" disabled={loading} onClick={() => onAction("cancelled")}>
            {t("queue.cancelEntry", "Cancel")}
          </Button>
        ) : null}
      </div>
      ) : null}
    </div>
  )
}

export function QueueBoard({
  entries,
  arrivals,
  highlightAppointmentId,
  apptCheckInId,
  onArrivalCheckIn,
  branchId,
  actionId,
  onAction,
  onReorderError,
  onReorderSuccess,
  readOnly = false,
}: {
  entries: QueueEntry[]
  arrivals: QueueBoardArrival[]
  highlightAppointmentId?: string | null
  apptCheckInId?: string | null
  onArrivalCheckIn: (appointmentId: string) => void
  branchId: string
  actionId: string | null
  onAction: (entryId: string, status: QueueStatus | "announce") => void
  onReorderError: (message: string) => void
  onReorderSuccess: () => void
  readOnly?: boolean
}) {
  const { t } = useLocale()
  const [dragEntryId, setDragEntryId] = React.useState<string | null>(null)
  const [dropColumnId, setDropColumnId] = React.useState<BoardColumn["id"] | null>(null)
  const [reordering, setReordering] = React.useState(false)
  const [staffMap, setStaffMap] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    const supabase = createClient()
    supabase
      .from("profiles")
      .select("id, full_name")
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {}
          data.forEach((p) => {
            if (p.full_name) map[p.id] = p.full_name
          })
          setStaffMap(map)
        }
      })
  }, [])

  const handleDrop = async (
    column: BoardColumn,
    targetEntryId: string | null,
    draggedId: string
  ) => {
    if (!column.dropStatus) return

    setDropColumnId(null)
    setDragEntryId(null)

    const dragged = entries.find((e) => e.id === draggedId)
    if (!dragged) return

    const colEntries = entries.filter((e) => column.statuses.includes(e.status))

    if (column.canReorder && column.statuses.includes(dragged.status)) {
      const without = colEntries.filter((e) => e.id !== draggedId)
      let ordered: QueueEntry[]
      if (targetEntryId) {
        const idx = without.findIndex((e) => e.id === targetEntryId)
        ordered = [...without.slice(0, idx), dragged, ...without.slice(idx)]
      } else {
        ordered = [...without, dragged]
      }
      setReordering(true)
      const { error } = await reorderQueueBoard(
        branchId,
        ordered.map((e) => e.id)
      )
      setReordering(false)
      if (error) {
        onReorderError(error)
        return
      }
      onReorderSuccess()
      return
    }

    if (dragged.status !== column.dropStatus) {
      onAction(draggedId, column.dropStatus)
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-neutral-500">
        {readOnly
          ? t("queue.historyBoardHint", "Read-only snapshot for the selected clinic day.")
          : t(
              "queue.liveBoardOperatingHint",
              "Front desk checks in arrivals here. After check-in, move patients Waiting -> Called -> In Chair -> Complete."
            )}
      </p>
      <div className="overflow-x-auto pb-1 xl:overflow-visible">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:min-w-[64rem]">
          {BOARD_COLUMNS.map((column) => {
            const colEntries =
              column.id === "arrivals"
                ? []
                : entries.filter((e) => column.statuses.includes(e.status))
            const isDropTarget = dropColumnId === column.id
            const count = column.id === "arrivals" ? arrivals.length : colEntries.length

            return (
              <div
                key={column.id}
                id={`queue-${column.id}`}
                className={cn(
                  "rounded-lg border border-neutral-200 p-4 min-h-[220px] shadow-sm transition-colors",
                  column.borderClass,
                  isDropTarget && column.dropStatus && "ring-2 ring-primary-400 bg-primary-50/30"
                )}
                onDragOver={(e) => {
                  if (readOnly || !column.dropStatus) return
                  e.preventDefault()
                  e.dataTransfer.dropEffect = "move"
                  setDropColumnId(column.id)
                }}
                onDragLeave={() => setDropColumnId((prev) => (prev === column.id ? null : prev))}
                onDrop={(e) => {
                  if (readOnly || !column.dropStatus) return
                  e.preventDefault()
                  const draggedId = e.dataTransfer.getData("text/queue-entry-id")
                  if (!draggedId) return
                  void handleDrop(column, null, draggedId)
                }}
              >
                <h2 className="font-semibold text-sm text-neutral-700 mb-3">
                  {t(column.titleKey, column.titleDefault)}
                  <span className="ml-2 text-neutral-400">({count})</span>
                </h2>
                <div className="space-y-2">
                  {column.id === "arrivals" ? (
                    arrivals.length === 0 ? (
                      <p className="text-xs text-neutral-400 py-4 text-center border border-dashed rounded-md px-2">
                        {t(
                          "queue.arrivalsColumnEmptyOperational",
                          "No scheduled arrivals waiting for check-in. Use Patient arrival for registered walk-ins, or New walk-in patient for first-time patients."
                        )}
                      </p>
                    ) : (
                      arrivals.map(({ appointment: appt, tone, minutesUntil }) => (
                        <ArrivalCardInner
                          key={appt.id}
                          appt={appt}
                          tone={tone}
                          minutesUntil={minutesUntil}
                          checkingIn={apptCheckInId === appt.id}
                          highlighted={highlightAppointmentId === appt.id}
                          onCheckIn={() => onArrivalCheckIn(appt.id)}
                          readOnly={readOnly}
                        />
                      ))
                    )
                  ) : (
                    <>
                      {colEntries.map((entry) => (
                        <div
                          key={entry.id}
                          onDragOver={(e) => {
                            if (readOnly || !column.canReorder) return
                            e.preventDefault()
                            e.stopPropagation()
                            setDropColumnId(column.id)
                          }}
                          onDrop={(e) => {
                            if (readOnly) return
                            e.preventDefault()
                            e.stopPropagation()
                            const draggedId = e.dataTransfer.getData("text/queue-entry-id")
                            if (!draggedId || draggedId === entry.id) return
                            void handleDrop(column, entry.id, draggedId)
                          }}
                        >
                          <QueueCard
                            entry={entry}
                            loading={actionId === entry.id || reordering}
                            draggable={!readOnly}
                            isDragging={dragEntryId === entry.id}
                            onDragStart={() => setDragEntryId(entry.id)}
                            onDragEnd={() => {
                              setDragEntryId(null)
                              setDropColumnId(null)
                            }}
                            onAction={(status) => onAction(entry.id, status)}
                            readOnly={readOnly}
                            staffMap={staffMap}
                          />
                        </div>
                      ))}
                      {colEntries.length === 0 ? (
                        <p className="text-xs text-neutral-400 py-4 text-center border border-dashed rounded-md">
                          {t("queue.columnEmpty", "Drop here")}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
