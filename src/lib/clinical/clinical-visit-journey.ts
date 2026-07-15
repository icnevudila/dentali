import type { PatientWithContacts } from "@/lib/patients/patient-service"
import type { PatientConsent } from "@/lib/patients/consent-service"
import type { PatientBalance, PatientBillingGate } from "@/lib/billing/invoice-service"
import type { TreatmentPlanSummary } from "@/lib/clinical/treatment-plan-service"
import type { TimelineEvent } from "@/lib/clinical/clinical-notes-service"
import type { AppointmentRecord } from "@/lib/appointments/types"
import type { PatientEncounterDetail } from "@/lib/clinical/encounter-service"
import { buildPatientRecordChecklist } from "@/lib/patients/patient-record-completeness"
import { findCheckInBlockingConsentSlug } from "@/lib/patients/checkin-consent"
import { normalizeIntakeConsentSlugs } from "@/lib/patients/intake-consent-slugs-service"

export type EncounterVisitStepId =
  | "file"
  | "checkin"
  | "chair"
  | "clinical-note"
  | "chart"
  | "treatment-plan"
  | "plan-approved"
  | "invoice"
  | "payment"
  | "discharge"

export type ClinicalVisitStepId =
  | "file"
  | "register"
  | "medical"
  | "consents"
  | "appointment"
  | "checkin"
  | "chair"
  | "clinical-note"
  | "chart"
  | "treatment-plan"
  | "plan-approved"
  | "invoice"
  | "payment"
  | "discharge"

export type ClinicalVisitStepStatus = "done" | "current" | "pending" | "blocked"

export type ClinicalVisitStep = {
  id: ClinicalVisitStepId
  label: string
  description: string
  status: ClinicalVisitStepStatus
  href?: string
  phase: "intake" | "visit" | "clinical" | "billing" | "discharge"
}

export type ClinicalVisitJourney = {
  steps: ClinicalVisitStep[]
  percentComplete: number
  nextStep: ClinicalVisitStep | null
  phaseLabel: string
  readyToClose?: boolean
}

/** Dentist clinical work — chart tab on the patient profile (not queue). */
export function encounterClinicalWorkHref(patientId: string, encounterId?: string | null) {
  const params = new URLSearchParams({ tab: "dental-chart" })
  if (encounterId) params.set("encounter", encounterId)
  return `/patients/${patientId}?${params.toString()}`
}


function intakeConsentsComplete(consents: PatientConsent[], intakeConsentSlugs?: readonly string[]) {
  return findCheckInBlockingConsentSlug(consents, normalizeIntakeConsentSlugs(intakeConsentSlugs)) === null
}

function appointmentProgress(appointments: AppointmentRecord[]) {
  const active = appointments.filter((a) => a.status !== "cancelled")
  const hasBooked = active.some((a) =>
    ["scheduled", "confirmed", "checked_in", "completed"].includes(a.status)
  )
  const hasCheckedIn = active.some((a) =>
    ["checked_in", "completed"].includes(a.status)
  )
  const hasCompletedVisit = active.some((a) => a.status === "completed")
  return { hasBooked, hasCheckedIn, hasCompletedVisit }
}

function resolveStepStatuses(
  order: ClinicalVisitStepId[],
  flags: Partial<Record<ClinicalVisitStepId, boolean>>
): Partial<Record<ClinicalVisitStepId, ClinicalVisitStepStatus>> {
  const statuses = {} as Partial<Record<ClinicalVisitStepId, ClinicalVisitStepStatus>>
  let foundCurrent = false

  for (const id of order) {
    if (flags[id]) {
      statuses[id] = "done"
      continue
    }
    if (!foundCurrent) {
      statuses[id] = "current"
      foundCurrent = true
    } else {
      statuses[id] = "pending"
    }
  }

  return statuses
}

function stepStatus(
  statuses: Partial<Record<ClinicalVisitStepId, ClinicalVisitStepStatus>>,
  id: ClinicalVisitStepId
): ClinicalVisitStepStatus {
  return statuses[id] ?? "pending"
}

function encounterStepStatus(
  statuses: Partial<Record<EncounterVisitStepId, ClinicalVisitStepStatus>>,
  id: EncounterVisitStepId
): ClinicalVisitStepStatus {
  return statuses[id] ?? "pending"
}

export function buildClinicalVisitJourney(params: {
  patientId: string
  patient: PatientWithContacts
  medicalHistory: { allergies: string[]; medications: string[]; conditions: string[] } | null
  consents: PatientConsent[]
  appointments: AppointmentRecord[]
  treatmentPlans: TreatmentPlanSummary[]
  balance: PatientBalance | null
  billingGate?: PatientBillingGate | null
  timeline: TimelineEvent[]
  hasChartFindings: boolean
  intakeConsentSlugs?: readonly string[]
}): ClinicalVisitJourney {
  const {
    patientId,
    patient,
    medicalHistory,
    consents,
    appointments,
    treatmentPlans,
    balance,
    billingGate,
    timeline,
    hasChartFindings,
    intakeConsentSlugs,
  } = params

  const { items: intakeItems } = buildPatientRecordChecklist({
    patient,
    medicalHistory,
    consents,
    patientId,
    intakeConsentSlugs,
  })

  const profileDone = intakeItems.find((i) => i.id === "profile")?.done ?? false
  const medicalDone = intakeItems.find((i) => i.id === "medical")?.done ?? false
  const consentsDone = intakeConsentsComplete(consents, intakeConsentSlugs)

  const { hasBooked, hasCheckedIn, hasCompletedVisit } = appointmentProgress(appointments)
  const hasClinicalNote = timeline.some((e) => e.event_type === "clinical_note")
  const hasPlan = treatmentPlans.length > 0
  const hasApprovedPlan = treatmentPlans.some((p) =>
    ["approved", "in_progress", "completed"].includes(p.status)
  )
  const missingPlanInvoices = billingGate?.approved_plans_missing_invoice.length ?? 0
  const hasInvoice =
    hasApprovedPlan &&
    missingPlanInvoices === 0 &&
    ((balance?.open_invoice_count ?? 0) > 0 || (balance?.total_billed ?? 0) > 0)
  const paymentDone =
    hasApprovedPlan && missingPlanInvoices === 0 && (balance?.open_balance ?? 0) <= 0

  const intakeOrder: ClinicalVisitStepId[] = [
    "register",
    "medical",
    "consents",
    "appointment",
    "checkin",
    "chair",
    "clinical-note",
    "chart",
    "treatment-plan",
    "plan-approved",
    "invoice",
    "payment",
  ]

  const flags: Partial<Record<ClinicalVisitStepId, boolean>> = {
    register: profileDone,
    medical: medicalDone,
    consents: consentsDone,
    appointment: hasBooked,
    checkin: hasCheckedIn || hasCompletedVisit,
    chair: hasCompletedVisit,
    "clinical-note": hasClinicalNote,
    chart: hasChartFindings,
    "treatment-plan": hasPlan,
    "plan-approved": hasApprovedPlan,
    invoice: hasInvoice,
    payment: paymentDone,
  }

  const statuses = resolveStepStatuses(intakeOrder, flags)

  const steps: ClinicalVisitStep[] = [
    {
      id: "register",
      label: "Patient registration",
      description: "Profile, contact, and demographics on file",
      status: stepStatus(statuses, "register"),
      href: profileDone ? undefined : `/patients/${patientId}/edit`,
      phase: "intake",
    },
    {
      id: "medical",
      label: "Medical history",
      description: "Allergies, medications, and conditions documented",
      status: stepStatus(statuses, "medical"),
      href: medicalDone ? undefined : `/patients/${patientId}/medical-history`,
      phase: "intake",
    },
    {
      id: "consents",
      label: "Consents signed",
      description: "Data privacy & general treatment consent on file",
      status: stepStatus(statuses, "consents"),
      href: consentsDone ? undefined : `/patients/${patientId}?tab=consents`,
      phase: "intake",
    },
    {
      id: "appointment",
      label: "Appointment booked",
      description: "Visit scheduled on the calendar",
      status: stepStatus(statuses, "appointment"),
      href: hasBooked ? `/appointments?patient=${patientId}` : `/appointments?patient=${patientId}`,
      phase: "visit",
    },
    {
      id: "checkin",
      label: "Check-in",
      description: "Front desk opened today's visit and queue entry",
      status: stepStatus(statuses, "checkin"),
      href: `/queue`,
      phase: "visit",
    },
    {
      id: "chair",
      label: "Chair / treatment",
      description: "Patient seated and clinical work in progress",
      status: stepStatus(statuses, "chair"),
      href: `/dentist`,
      phase: "visit",
    },
    {
      id: "clinical-note",
      label: "Clinical note",
      description: "SOAP note recorded for this visit",
      status: stepStatus(statuses, "clinical-note"),
      href: hasClinicalNote
        ? `/patients/${patientId}?tab=clinical-notes`
        : `/patients/${patientId}?tab=clinical-notes`,
      phase: "clinical",
    },
    {
      id: "chart",
      label: "Dental chart",
      description: "Odontogram findings saved for treated teeth",
      status: stepStatus(statuses, "chart"),
      href: `/patients/${patientId}/chart`,
      phase: "clinical",
    },
    {
      id: "treatment-plan",
      label: "Treatment plan",
      description: "Procedures proposed from chart or catalog",
      status: stepStatus(statuses, "treatment-plan"),
      href: `/patients/${patientId}/treatment-plan`,
      phase: "clinical",
    },
    {
      id: "plan-approved",
      label: "Plan approved",
      description: "Patient accepted plan — triggers invoice draft when workflow is on",
      status: stepStatus(statuses, "plan-approved"),
      href: `/patients/${patientId}/treatment-plan`,
      phase: "clinical",
    },
    {
      id: "invoice",
      label: "Invoice issued",
      description: "Billing record created from approved plan or manual entry",
      status: stepStatus(statuses, "invoice"),
      href: `/billing?patient=${patientId}`,
      phase: "billing",
    },
    {
      id: "payment",
      label: "Payment collected",
      description: "Balance settled — cash, card, GCash, or HMO",
      status: stepStatus(statuses, "payment"),
      href:
        (balance?.open_balance ?? 0) > 0
          ? `/billing?patient=${patientId}`
          : `/billing?patient=${patientId}`,
      phase: "billing",
    },
  ]

  const doneCount = steps.filter((s) => s.status === "done").length
  const allDone = doneCount === steps.length
  const percentComplete = allDone ? 100 : Math.round((doneCount / steps.length) * 100)
  const nextStep = allDone ? null : (steps.find((s) => s.status === "current") ?? null)

  const phaseLabel =
    allDone || paymentDone
      ? "Visit complete"
      : nextStep?.phase === "intake"
        ? "Intake — before first visit"
        : nextStep?.phase === "visit"
          ? "Front desk — day of visit"
          : nextStep?.phase === "clinical"
            ? "Chair — clinical work"
            : nextStep?.phase === "billing"
              ? "Billing — checkout"
              : "Clinical journey"

  return { steps, percentComplete, nextStep, phaseLabel }
}

function encounterInvoicePaid(invoices: PatientEncounterDetail["invoices"]) {
  if (invoices.length === 0) return false
  return invoices.every(
    (inv) => inv.status === "paid" || inv.paid_amount >= inv.total_amount
  )
}

function encounterHasApprovedPlan(plans: PatientEncounterDetail["plans"]) {
  return plans.some((p) => ["approved", "in_progress", "completed"].includes(p.status))
}

/** Per-arrival journey — %100 means this encounter is complete, not lifetime patient history. */
export function buildEncounterVisitJourney(params: {
  patientId: string
  detail: PatientEncounterDetail
  hasChartFindings?: boolean
  fileReady?: boolean
  pendingConsents?: number
}): ClinicalVisitJourney & { encounterId: string; encounterStatus: string } {
  const {
    patientId,
    detail,
    hasChartFindings = false,
    fileReady = true,
    pendingConsents = 0,
  } = params
  const enc = detail.encounter
  const queue = detail.queue
  const notes = detail.notes
  const plans = detail.plans
  const invoices = detail.invoices

  const isClosed = enc.status === "closed"
  const hasCheckin = Boolean(queue)
  const chairDone = Boolean(
    queue && ["in_chair", "served"].includes(queue.status)
  )
  const chairLabel =
    queue?.status === "ready"
      ? "Called — patient ready for chair"
      : queue?.status === "now_serving"
        ? "Now serving — escort to chair"
        : queue?.chair_label
          ? `Chair ${queue.chair_label}`
          : queue?.status === "in_chair"
            ? "Patient seated — clinical work in progress"
            : queue?.status === "served"
              ? "Treatment complete"
              : "Patient seated and clinical work in progress"
  const hasNote = notes.length > 0
  const hasSignedNote = notes.some((n) => n.status === "signed")
  const hasPlan = plans.length > 0
  const hasApprovedPlan = encounterHasApprovedPlan(plans)
  const hasInvoice = invoices.length > 0
  const paymentDone = hasInvoice && encounterInvoicePaid(invoices)

  const flags: Record<EncounterVisitStepId, boolean> = {
    file: fileReady,
    checkin: hasCheckin,
    chair: chairDone,
    "clinical-note": hasSignedNote || hasNote,
    chart: hasChartFindings,
    "treatment-plan": hasPlan,
    "plan-approved": hasApprovedPlan,
    invoice: hasInvoice,
    payment: paymentDone,
    discharge: isClosed,
  }

  const order: EncounterVisitStepId[] = [
    "file",
    "checkin",
    "chair",
    "clinical-note",
    "chart",
    "treatment-plan",
    "plan-approved",
    "invoice",
    "payment",
    "discharge",
  ]

  const statuses = {} as Record<EncounterVisitStepId, ClinicalVisitStepStatus>
  let foundCurrent = false
  for (const id of order) {
    if (isClosed || flags[id]) {
      statuses[id] = "done"
      continue
    }
    if (!foundCurrent) {
      statuses[id] = "current"
      foundCurrent = true
    } else {
      statuses[id] = "pending"
    }
  }

  const noteHref = notes[0]
    ? `/patients/${patientId}?tab=clinical-notes`
    : `/patients/${patientId}?tab=clinical-notes&encounter=${enc.id}`
  const planHref = `/patients/${patientId}/treatment-plan${enc.id ? `?encounter=${enc.id}` : ""}`
  const billingHref =
    invoices[0]?.id
      ? `/billing/${invoices[0].id}`
      : `/billing?patient=${patientId}`

  const fileHref =
    pendingConsents > 0
      ? `/patients/${patientId}?tab=consents`
      : `/patients/${patientId}?tab=medical-history`

  const steps: ClinicalVisitStep[] = [
    {
      id: "file",
      label: "Patient file",
      description: fileReady
        ? "Registration, medical history, and consents clear"
        : pendingConsents > 0
          ? `${pendingConsents} consent form(s) awaiting signature`
          : "Complete medical history and consents before treatment",
      status: statuses.file,
      href: fileReady ? undefined : fileHref,
      phase: "intake",
    },
    {
      id: "checkin",
      label: "Check-in",
      description: queue
        ? `Queue ${queue.display_code} — ${queue.status.replace(/_/g, " ")}`
        : "Front desk opens the visit and queue entry",
      status: statuses.checkin,
      href: "/queue",
      phase: "visit",
    },
    {
      id: "chair",
      label: "Chair / treatment",
      description: chairLabel,
      status: statuses.chair,
      href: encounterClinicalWorkHref(patientId, enc.id),
      phase: "visit",
    },
    {
      id: "clinical-note",
      label: "Clinical note",
      description: hasSignedNote
        ? "SOAP note signed for this visit"
        : hasNote
          ? "Draft note — sign when complete"
          : "Record examination findings",
      status: encounterStepStatus(statuses, "clinical-note"),
      href: noteHref,
      phase: "clinical",
    },
    {
      id: "chart",
      label: "Dental chart",
      description: "Odontogram updated for treated teeth",
      status: encounterStepStatus(statuses, "chart"),
      href: `/patients/${patientId}/chart`,
      phase: "clinical",
    },
    {
      id: "treatment-plan",
      label: "Treatment plan",
      description: "Procedures proposed for this visit",
      status: encounterStepStatus(statuses, "treatment-plan"),
      href: planHref,
      phase: "clinical",
    },
    {
      id: "plan-approved",
      label: "Plan approved",
      description: "Patient accepted proposed treatment",
      status: encounterStepStatus(statuses, "plan-approved"),
      href: planHref,
      phase: "clinical",
    },
    {
      id: "invoice",
      label: "Invoice",
      description: "Billing record for this visit",
      status: encounterStepStatus(statuses, "invoice"),
      href: billingHref,
      phase: "billing",
    },
    {
      id: "payment",
      label: "Payment",
      description: "Visit balance settled",
      status: encounterStepStatus(statuses, "payment"),
      href: billingHref,
      phase: "billing",
    },
    {
      id: "discharge",
      label: "Checkout / Discharge",
      description: isClosed
        ? "Visit closed on file"
        : "Close today’s visit: clinical note, billing, payment, then discharge",
      status: statuses.discharge,
      href: `/patients/${patientId}?checkout=1`,
      phase: "discharge",
    },
  ]

  const doneCount = steps.filter((s) => s.status === "done").length
  const allDone = isClosed || doneCount === steps.length
  const percentComplete = allDone ? 100 : Math.round((doneCount / steps.length) * 100)
  const nextStep = allDone ? null : (steps.find((s) => s.status === "current") ?? null)
  const readyToClose = !isClosed && nextStep?.id === "discharge"

  const phaseLabel = isClosed
    ? "Visit closed"
    : readyToClose
      ? "Ready for checkout / discharge"
      : nextStep?.phase === "intake"
        ? "Intake — file & consents"
        : nextStep?.phase === "visit"
          ? "Front desk — arrival"
          : nextStep?.phase === "clinical"
            ? "Chair — clinical work"
            : nextStep?.phase === "billing"
              ? "Billing — checkout"
              : nextStep?.phase === "discharge"
                ? "Discharge — close visit"
                : "Active visit"

  return {
    steps,
    percentComplete,
    nextStep,
    phaseLabel,
    readyToClose,
    encounterId: enc.id,
    encounterStatus: enc.status,
  }
}
