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

/** Patient IDs with an active queue entry (walk-in/kiosk may omit appointment_id). */
export function activeQueuedPatientIds(dayEntries: QueueEntry[]): Set<string> {
  const ids = new Set<string>()
  for (const entry of dayEntries) {
    if (ACTIVE_QUEUE_STATUSES.has(entry.status)) {
      ids.add(entry.patient_id)
    }
  }
  return ids
}

export function filterPendingCheckInAppointments(
  appointments: AppointmentRecord[],
  dayEntries: QueueEntry[]
): AppointmentRecord[] {
  const queuedAppointments = activeQueuedAppointmentIds(dayEntries)
  const queuedPatients = activeQueuedPatientIds(dayEntries)
  return appointments.filter(
    (a) =>
      PENDING_CHECK_IN_APPOINTMENT_STATUSES.has(a.status) &&
      !queuedAppointments.has(a.id) &&
      !queuedPatients.has(a.patient_id)
  )
}
