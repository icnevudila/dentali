import type { PatientWithContacts } from "@/lib/patients/patient-service"
import type { PatientConsent } from "@/lib/patients/consent-service"
import type { PatientBalance } from "@/lib/billing/invoice-service"
import type { TreatmentPlanSummary } from "@/lib/clinical/treatment-plan-service"
import type { TimelineEvent } from "@/lib/clinical/clinical-notes-service"
import type { AppointmentRecord } from "@/lib/appointments/types"
import { buildPatientRecordChecklist } from "@/lib/patients/patient-record-completeness"

export type ClinicalVisitStepId =
  | "register"
  | "medical"
  | "consents"
  | "appointment"
  | "checkin"
  | "clinical-note"
  | "chart"
  | "treatment-plan"
  | "plan-approved"
  | "invoice"
  | "payment"

export type ClinicalVisitStepStatus = "done" | "current" | "pending" | "blocked"

export type ClinicalVisitStep = {
  id: ClinicalVisitStepId
  label: string
  description: string
  status: ClinicalVisitStepStatus
  href?: string
  phase: "intake" | "visit" | "clinical" | "billing"
}

export type ClinicalVisitJourney = {
  steps: ClinicalVisitStep[]
  percentComplete: number
  nextStep: ClinicalVisitStep | null
  phaseLabel: string
}

function hasSignedConsent(consents: PatientConsent[], slug: string) {
  return consents.some((c) => c.template_slug === slug && c.status === "signed")
}

function appointmentProgress(appointments: AppointmentRecord[]) {
  const active = appointments.filter((a) => a.status !== "cancelled")
  const hasBooked = active.some((a) =>
    ["scheduled", "confirmed", "checked_in", "in_progress", "completed"].includes(a.status)
  )
  const hasCheckedIn = active.some((a) =>
    ["checked_in", "in_progress", "completed"].includes(a.status)
  )
  const hasCompletedVisit = active.some((a) => a.status === "completed")
  return { hasBooked, hasCheckedIn, hasCompletedVisit }
}

function resolveStepStatuses(
  flags: Record<ClinicalVisitStepId, boolean>
): Record<ClinicalVisitStepId, ClinicalVisitStepStatus> {
  const order: ClinicalVisitStepId[] = [
    "register",
    "medical",
    "consents",
    "appointment",
    "checkin",
    "clinical-note",
    "chart",
    "treatment-plan",
    "plan-approved",
    "invoice",
    "payment",
  ]

  const statuses = {} as Record<ClinicalVisitStepId, ClinicalVisitStepStatus>
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

export function buildClinicalVisitJourney(params: {
  patientId: string
  patient: PatientWithContacts
  medicalHistory: { allergies: string[]; medications: string[]; conditions: string[] } | null
  consents: PatientConsent[]
  appointments: AppointmentRecord[]
  treatmentPlans: TreatmentPlanSummary[]
  balance: PatientBalance | null
  timeline: TimelineEvent[]
  hasChartFindings: boolean
}): ClinicalVisitJourney {
  const {
    patientId,
    patient,
    medicalHistory,
    consents,
    appointments,
    treatmentPlans,
    balance,
    timeline,
    hasChartFindings,
  } = params

  const { items: intakeItems } = buildPatientRecordChecklist({
    patient,
    medicalHistory,
    consents,
    patientId,
  })

  const profileDone = intakeItems.find((i) => i.id === "profile")?.done ?? false
  const medicalDone = intakeItems.find((i) => i.id === "medical")?.done ?? false
  const consentsDone =
    hasSignedConsent(consents, "dpa-consent") && hasSignedConsent(consents, "general-treatment")

  const { hasBooked, hasCheckedIn, hasCompletedVisit } = appointmentProgress(appointments)
  const hasClinicalNote = timeline.some((e) => e.event_type === "clinical_note")
  const hasPlan = treatmentPlans.length > 0
  const hasApprovedPlan = treatmentPlans.some((p) =>
    ["approved", "in_progress", "completed"].includes(p.status)
  )
  const hasInvoice =
    (balance?.open_invoice_count ?? 0) > 0 || (balance?.total_billed ?? 0) > 0
  const paymentDone =
    hasApprovedPlan &&
    (balance?.open_balance ?? 0) <= 0 &&
    (balance?.total_paid ?? 0) > 0

  const flags: Record<ClinicalVisitStepId, boolean> = {
    register: profileDone,
    medical: medicalDone,
    consents: consentsDone,
    appointment: hasBooked,
    checkin: hasCheckedIn || hasCompletedVisit,
    "clinical-note": hasClinicalNote,
    chart: hasChartFindings,
    "treatment-plan": hasPlan,
    "plan-approved": hasApprovedPlan,
    invoice: hasInvoice,
    payment: paymentDone,
  }

  const statuses = resolveStepStatuses(flags)

  const steps: ClinicalVisitStep[] = [
    {
      id: "register",
      label: "Patient registration",
      description: "Profile, contact, and demographics on file",
      status: statuses.register,
      href: profileDone ? undefined : `/patients/${patientId}/edit`,
      phase: "intake",
    },
    {
      id: "medical",
      label: "Medical history",
      description: "Allergies, medications, and conditions documented",
      status: statuses.medical,
      href: medicalDone ? undefined : `/patients/${patientId}/medical-history`,
      phase: "intake",
    },
    {
      id: "consents",
      label: "Consents signed",
      description: "DPA and general treatment consent on file",
      status: statuses.consents,
      href: consentsDone ? undefined : `/patients/${patientId}?tab=consents`,
      phase: "intake",
    },
    {
      id: "appointment",
      label: "Appointment booked",
      description: "Visit scheduled on the calendar",
      status: statuses.appointment,
      href: hasBooked ? `/appointments?patient=${patientId}` : `/appointments?patient=${patientId}`,
      phase: "visit",
    },
    {
      id: "checkin",
      label: "Check-in & chair",
      description: "Patient checked in and moved through the queue",
      status: statuses.checkin,
      href: hasCheckedIn ? `/queue` : `/queue`,
      phase: "visit",
    },
    {
      id: "clinical-note",
      label: "Clinical note",
      description: "SOAP note recorded for this visit",
      status: statuses["clinical-note"],
      href: hasClinicalNote
        ? `/patients/${patientId}?tab=clinical-notes`
        : `/patients/${patientId}?tab=clinical-notes`,
      phase: "clinical",
    },
    {
      id: "chart",
      label: "Dental chart",
      description: "Odontogram findings saved for treated teeth",
      status: statuses.chart,
      href: `/patients/${patientId}/chart`,
      phase: "clinical",
    },
    {
      id: "treatment-plan",
      label: "Treatment plan",
      description: "Procedures proposed from chart or catalog",
      status: statuses["treatment-plan"],
      href: `/patients/${patientId}/treatment-plan`,
      phase: "clinical",
    },
    {
      id: "plan-approved",
      label: "Plan approved",
      description: "Patient accepted plan — triggers invoice draft when workflow is on",
      status: statuses["plan-approved"],
      href: `/patients/${patientId}/treatment-plan`,
      phase: "clinical",
    },
    {
      id: "invoice",
      label: "Invoice issued",
      description: "Billing record created from approved plan or manual entry",
      status: statuses.invoice,
      href: `/billing?patient=${patientId}`,
      phase: "billing",
    },
    {
      id: "payment",
      label: "Payment collected",
      description: "Balance settled — cash, card, GCash, or HMO",
      status: statuses.payment,
      href:
        (balance?.open_balance ?? 0) > 0
          ? `/billing?patient=${patientId}`
          : `/billing?patient=${patientId}`,
      phase: "billing",
    },
  ]

  const doneCount = steps.filter((s) => s.status === "done").length
  const percentComplete = Math.round((doneCount / steps.length) * 100)
  const nextStep = steps.find((s) => s.status === "current") ?? null

  const phaseLabel =
    nextStep?.phase === "intake"
      ? "Intake — before first visit"
      : nextStep?.phase === "visit"
        ? "Front desk — day of visit"
        : nextStep?.phase === "clinical"
          ? "Chair — clinical work"
          : nextStep?.phase === "billing"
            ? "Billing — checkout"
            : paymentDone
              ? "Visit complete"
              : "Clinical journey"

  return { steps, percentComplete, nextStep, phaseLabel }
}
