import { waitMinutes, type QueueEntry } from "@/lib/queue/queue-service"
import type { QueueDayStats } from "@/components/queue/QueueDaySummary"

export function computeQueueDayStats(dayEntries: QueueEntry[]): QueueDayStats {
  const served = dayEntries.filter((e) => e.status === "served")
  const cancelled = dayEntries.filter((e) => e.status === "cancelled")
  const active = dayEntries.filter((e) => !["served", "cancelled"].includes(e.status))
  const waiting = active.filter((e) => e.status === "waiting").length
  const serving = active.filter(
    (e) => e.status === "now_serving" || e.status === "in_chair" || e.status === "ready"
  ).length
  const avgWaitActive =
    active.length > 0
      ? Math.round(active.reduce((s, e) => s + waitMinutes(e.checked_in_at), 0) / active.length)
      : 0
  const completedWithTime = served.filter((e) => e.completed_at)
  const avgVisitMins =
    completedWithTime.length > 0
      ? Math.round(
          completedWithTime.reduce(
            (s, e) =>
              s +
              (new Date(e.completed_at!).getTime() - new Date(e.checked_in_at).getTime()) / 60000,
            0
          ) / completedWithTime.length
        )
      : 0

  return {
    checkedIn: dayEntries.length,
    active: active.length,
    waiting,
    serving,
    served: served.length,
    cancelled: cancelled.length,
    avgWaitActive,
    avgVisitMins,
  }
}
