/**
 * Unit checks for pending check-in filter (no DB).
 * Run: npx tsx scripts/verify-pending-arrivals.ts
 */
import {
  activeQueuedAppointmentIds,
  activeQueuedPatientIds,
  filterPendingCheckInAppointments,
} from "../src/lib/queue/pending-arrivals"
import type { AppointmentRecord } from "../src/lib/appointments/types"
import type { QueueEntry } from "../src/lib/queue/queue-service"

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const appt = (
  id: string,
  status: AppointmentRecord["status"],
  patientId = "p1"
): AppointmentRecord =>
  ({
    id,
    status,
    patient_id: patientId,
    scheduled_at: new Date().toISOString(),
  }) as AppointmentRecord

const entry = (
  appointmentId: string | null,
  status: QueueEntry["status"],
  patientId = "p1"
): QueueEntry =>
  ({
    id: `q-${appointmentId ?? "walk"}-${status}`,
    appointment_id: appointmentId,
    patient_id: patientId,
    status,
    branch_id: "b1",
  }) as unknown as QueueEntry

// scheduled + no queue → pending
{
  const pending = filterPendingCheckInAppointments([appt("a1", "scheduled")], [])
  assert(pending.length === 1 && pending[0].id === "a1", "scheduled should be pending")
}

// scheduled + waiting queue → not pending
{
  const pending = filterPendingCheckInAppointments(
    [appt("a1", "scheduled")],
    [entry("a1", "waiting")]
  )
  assert(pending.length === 0, "active queue should hide from check-in")
}

// served queue does not block re-check-in for stale checked_in
{
  const pending = filterPendingCheckInAppointments(
    [appt("a1", "checked_in")],
    [entry("a1", "served")]
  )
  assert(pending.length === 1, "checked_in without active queue should be pending")
}

// activeQueuedAppointmentIds ignores served
{
  const ids = activeQueuedAppointmentIds([entry("a1", "served"), entry("a2", "in_chair")])
  assert(ids.has("a2") && !ids.has("a1"), "only active statuses count")
}

// walk-in queue (no appointment_id) hides same patient's appointment from check-in
{
  const pending = filterPendingCheckInAppointments(
    [appt("a1", "scheduled", "p1")],
    [entry(null, "waiting", "p1")]
  )
  assert(pending.length === 0, "active patient queue should hide appointment from arrivals")
}

// activeQueuedPatientIds
{
  const ids = activeQueuedPatientIds([entry(null, "waiting", "p1"), entry("a2", "served", "p2")])
  assert(ids.has("p1") && !ids.has("p2"), "only active queue patients count")
}

console.log("verify-pending-arrivals: ok")
