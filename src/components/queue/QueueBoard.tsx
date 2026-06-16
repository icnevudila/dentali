"use client"

import * as React from "react"
import Link from "next/link"
import { Megaphone, Undo2, GripVertical } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/use-locale"
import {
  reorderQueueBoard,
  waitMinutes,
  type QueueEntry,
  type QueueStatus,
} from "@/lib/queue/queue-service"
import { cn } from "@/lib/utils"

type BoardColumn = {
  id: "waiting" | "serving" | "chair"
  titleKey: string
  titleDefault: string
  statuses: QueueStatus[]
  dropStatus: QueueStatus
  borderClass: string
  canReorder: boolean
}

const BOARD_COLUMNS: BoardColumn[] = [
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
    titleDefault: "Now Serving",
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

function QueueCard({
  entry,
  onAction,
  loading,
  draggable,
  onDragStart,
  onDragEnd,
  isDragging,
}: {
  entry: QueueEntry
  onAction: (status: QueueStatus | "announce", chair?: string) => void
  loading: boolean
  draggable: boolean
  onDragStart: () => void
  onDragEnd: () => void
  isDragging: boolean
}) {
  const mins = waitMinutes(entry.checked_in_at)
  const { t } = useLocale()

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
        entry.appointment_id
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
            </div>
            <Link href={`/patients/${entry.patient_id}`} className="block text-sm font-medium text-neutral-900 hover:underline truncate">
              {entry.patient_name ?? "Patient"}
            </Link>
          </div>
        </div>
        <Badge variant={entry.status === "ready" ? "info" : "warning"}>{entry.status.replace("_", " ")}</Badge>
      </div>
      <p className="text-xs text-neutral-500 mt-1">{mins} min waiting</p>
      {entry.chair_label ? <p className="text-xs text-neutral-600">Chair: {entry.chair_label}</p> : null}
      {entry.notes ? <p className="text-xs text-neutral-400 mt-1 truncate">{entry.notes}</p> : null}
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
    </div>
  )
}

export function QueueBoard({
  entries,
  branchId,
  actionId,
  onAction,
  onReorderError,
  onReorderSuccess,
}: {
  entries: QueueEntry[]
  branchId: string
  actionId: string | null
  onAction: (entryId: string, status: QueueStatus | "announce") => void
  onReorderError: (message: string) => void
  onReorderSuccess: () => void
}) {
  const { t } = useLocale()
  const [dragEntryId, setDragEntryId] = React.useState<string | null>(null)
  const [dropColumnId, setDropColumnId] = React.useState<BoardColumn["id"] | null>(null)
  const [reordering, setReordering] = React.useState(false)

  const handleDrop = async (
    column: BoardColumn,
    targetEntryId: string | null,
    draggedId: string
  ) => {
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
      <p className="text-xs text-neutral-500">{t("queue.dragHint", "Drag cards between columns to move patients. Reorder within Waiting by dropping on another card.")}</p>
      <div className="grid gap-4 xl:grid-cols-3">
        {BOARD_COLUMNS.map((column) => {
          const colEntries = entries.filter((e) => column.statuses.includes(e.status))
          const isDropTarget = dropColumnId === column.id

          return (
            <div
              key={column.id}
              className={cn(
                "rounded-lg border border-neutral-200 p-4 min-h-[200px] shadow-sm transition-colors",
                column.borderClass,
                isDropTarget && "ring-2 ring-primary-400 bg-primary-50/30"
              )}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = "move"
                setDropColumnId(column.id)
              }}
              onDragLeave={() => setDropColumnId((prev) => (prev === column.id ? null : prev))}
              onDrop={(e) => {
                e.preventDefault()
                const draggedId = e.dataTransfer.getData("text/queue-entry-id")
                if (!draggedId) return
                void handleDrop(column, null, draggedId)
              }}
            >
              <h2 className="font-semibold text-sm text-neutral-700 mb-3">
                {t(column.titleKey, column.titleDefault)}
                <span className="ml-2 text-neutral-400">({colEntries.length})</span>
              </h2>
              <div className="space-y-2">
                {colEntries.map((entry) => (
                  <div
                    key={entry.id}
                    onDragOver={(e) => {
                      if (!column.canReorder) return
                      e.preventDefault()
                      e.stopPropagation()
                      setDropColumnId(column.id)
                    }}
                    onDrop={(e) => {
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
                      draggable
                      isDragging={dragEntryId === entry.id}
                      onDragStart={() => setDragEntryId(entry.id)}
                      onDragEnd={() => {
                        setDragEntryId(null)
                        setDropColumnId(null)
                      }}
                      onAction={(status) => onAction(entry.id, status)}
                    />
                  </div>
                ))}
                {colEntries.length === 0 ? (
                  <p className="text-xs text-neutral-400 py-4 text-center border border-dashed rounded-md">
                    {t("queue.columnEmpty", "Drop here")}
                  </p>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
