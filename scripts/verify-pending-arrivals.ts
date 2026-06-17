/**
 * Unit checks for pending check-in filter (no DB).
 * Run: npx tsx scripts/verify-pending-arrivals.ts
 */
import {
  activeQueuedAppointmentIds,
  filterPendingCheckInAppointments,
} from "../src/lib/queue/pending-arrivals"
import type { AppointmentRecord } from "../src/lib/appointments/types"
import type { QueueEntry } from "../src/lib/queue/queue-service"

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const appt = (id: string, status: AppointmentRecord["status"]): AppointmentRecord =>
  ({
    id,
    status,
    patient_id: "p1",
    scheduled_at: new Date().toISOString(),
  }) as AppointmentRecord

const entry = (appointmentId: string | null, status: QueueEntry["status"]): QueueEntry =>
  ({
    id: `q-${appointmentId}-${status}`,
    appointment_id: appointmentId,
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

console.log("verify-pending-arrivals: ok")
