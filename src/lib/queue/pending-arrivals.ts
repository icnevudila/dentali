import type { AppointmentRecord } from "@/lib/appointments/types"
import type { QueueEntry } from "@/lib/queue/queue-service"

const ACTIVE_QUEUE_STATUSES = new Set(["waiting", "ready", "now_serving", "in_chair"])

const PENDING_CHECK_IN_APPOINTMENT_STATUSES = new Set(["scheduled", "confirmed", "checked_in"])

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
    (a) => PENDING_CHECK_IN_APPOINTMENT_STATUSES.has(a.status) && !queued.has(a.id)
  )
}
