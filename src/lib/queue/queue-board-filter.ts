import type { QueueEntry } from "@/lib/queue/queue-service"

export type QueueBoardFilter =
  | "all"
  | "in_chair"
  | "now_serving"
  | "waiting"
  | "queue_waiting"
  | "serving"
  | "served"
  | "cancelled"
  | "day_all"

const VALID_FILTERS: QueueBoardFilter[] = [
  "in_chair",
  "now_serving",
  "waiting",
  "queue_waiting",
  "serving",
  "served",
  "cancelled",
  "day_all",
]

export function parseQueueBoardFilter(value: string | null): QueueBoardFilter {
  if (value && VALID_FILTERS.includes(value as QueueBoardFilter)) {
    return value as QueueBoardFilter
  }
  return "all"
}

export function filterQueueBoardEntries(
  entries: QueueEntry[],
  filter: QueueBoardFilter
): QueueEntry[] {
  switch (filter) {
    case "in_chair":
      return entries.filter((e) => e.status === "in_chair")
    case "now_serving":
      return entries.filter((e) => e.status === "now_serving")
    case "waiting":
      return entries.filter((e) => e.status === "waiting" || e.status === "ready")
    case "queue_waiting":
      return entries.filter((e) => e.status === "waiting")
    case "serving":
      return entries.filter((e) =>
        ["now_serving", "in_chair", "ready"].includes(e.status)
      )
    case "served":
      return entries.filter((e) => e.status === "served")
    case "cancelled":
      return entries.filter((e) => e.status === "cancelled")
    case "day_all":
      return entries
    default:
      return entries.filter((e) => !["served", "cancelled"].includes(e.status))
  }
}

export const DAY_SCOPED_QUEUE_FILTERS: QueueBoardFilter[] = [
  "day_all",
  "served",
  "cancelled",
  "queue_waiting",
]
