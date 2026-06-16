/**
 * Lightweight checks for encounter visit journey (no DB).
 * Run: npx tsx scripts/verify-encounter-journey.ts
 */
import { buildEncounterVisitJourney } from "../src/lib/clinical/clinical-visit-journey"
import type { PatientEncounterDetail } from "../src/lib/clinical/encounter-service"

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const baseDetail: PatientEncounterDetail = {
  encounter: {
    id: "enc-1",
    display_code: "VIS-TEST01",
    source_type: "appointment",
    status: "open",
    opened_at: new Date().toISOString(),
    closed_at: null,
    patient_id: "pat-1",
    branch_id: "br-1",
    appointment_id: "appt-1",
    queue_entry_id: "q-1",
  },
  queue: {
    id: "q-1",
    status: "waiting",
    display_code: "A-12",
    chair_label: null,
    checked_in_at: new Date().toISOString(),
    completed_at: null,
    in_chair_at: null,
    called_at: null,
  },
  appointment: null,
  notes: [],
  plans: [],
  invoices: [],
}

const waitingJourney = buildEncounterVisitJourney({
  patientId: "pat-1",
  detail: baseDetail,
  hasChartFindings: false,
})

assert(waitingJourney.percentComplete < 50, "waiting patient should be early in journey")
assert(waitingJourney.steps.find((s) => s.id === "chair")?.status === "current", "chair is current when waiting")

const inChairJourney = buildEncounterVisitJourney({
  patientId: "pat-1",
  detail: {
    ...baseDetail,
    queue: { ...baseDetail.queue!, status: "in_chair", in_chair_at: new Date().toISOString() },
    notes: [{ id: "n1", title: "Note", status: "signed", signed_at: new Date().toISOString(), created_at: new Date().toISOString() }],
  },
  hasChartFindings: true,
})

assert(inChairJourney.steps.find((s) => s.id === "chair")?.status === "done", "chair done when in_chair")
assert(inChairJourney.steps.find((s) => s.id === "clinical-note")?.status === "done", "note step done with signed note")

console.log("verify-encounter-journey: OK")
