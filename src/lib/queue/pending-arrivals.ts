import type { AppointmentRecord } from "@/lib/appointments/types"
import type { QueueEntry } from "@/lib/queue/queue-service"

const ACTIVE_QUEUE_STATUSES = new Set(["waiting", "ready", "now_serving", "in_chair"])

/** Appointment IDs linked to a queue entry that is still in clinic today. */
export function activeQueuedAppointmentIds(dayEntries: QueueEntry[]): Set<string> {
  const ids = new Set<string>()
  for (const entry of dayEntries) {
    if (entry.appointment_id && ACTIVE_QUEUE_STATUSES.has(entry.status)) {
      ids.add(entry.appointment_id)
    }
  }
  return ids
}

export function filterPendingCheckInAppointments(
  appointments: AppointmentRecord[],
  dayEntries: QueueEntry[]
): AppointmentRecord[] {
  const queued = activeQueuedAppointmentIds(dayEntries)
  return appointments.filter(
    (a) =>
      (a.status === "scheduled" || a.status === "confirmed") && !queued.has(a.id)
  )
}
