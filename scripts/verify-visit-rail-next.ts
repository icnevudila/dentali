/**
 * Smoke checks for visit rail Next / Finish visit path matching.
 * Run: npx tsx scripts/verify-visit-rail-next.ts
 */
import { resolveVisitRailAction } from "../src/lib/patients/visit-rail-next"
import type { ClinicalVisitStep } from "../src/lib/clinical/clinical-visit-journey"

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

const noteStep: ClinicalVisitStep = {
  id: "clinical-note",
  label: "Clinical note",
  description: "SOAP",
  status: "current",
  href: "/patients/abc?tab=clinical-notes",
  phase: "clinical",
}

const dischargeStep: ClinicalVisitStep = {
  id: "discharge",
  label: "Finish visit",
  description: "Close",
  status: "pending",
  href: "/patients/abc",
  phase: "discharge",
}

const chartStep: ClinicalVisitStep = {
  id: "chart",
  label: "Dental chart",
  description: "Chart",
  status: "pending",
  href: "/patients/abc/chart",
  phase: "clinical",
}

const journey = {
  steps: [noteStep, chartStep, dischargeStep],
  nextStep: noteStep,
  readyToClose: false,
}

const onNotes = resolveVisitRailAction(journey, "/patients/abc/notes")
assert(onNotes.kind === "next" && onNotes.step.id === "chart", "notes path should advance past clinical-note")

const onProfile = resolveVisitRailAction(
  { steps: [dischargeStep], nextStep: dischargeStep, readyToClose: false },
  "/patients/abc"
)
assert(onProfile.kind === "checkout", "profile root discharge should be Finish visit")

const nestedNotDischarge = resolveVisitRailAction(
  { steps: [dischargeStep], nextStep: dischargeStep, readyToClose: false },
  "/patients/abc/chart"
)
assert(
  nestedNotDischarge.kind === "checkout" || nestedNotDischarge.kind === "none",
  "nested routes must not falsely match broken discharge logic"
)

console.log("verify-visit-rail-next: ok")
