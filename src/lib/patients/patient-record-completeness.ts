import type { PatientWithContacts } from "@/lib/patients/patient-service"
import type { PatientConsent } from "@/lib/patients/consent-service"
import { findCheckInBlockingConsentSlug } from "@/lib/patients/checkin-consent"
import { normalizeIntakeConsentSlugs } from "@/lib/patients/intake-consent-slugs-service"

export type RecordChecklistItem = {
  id: string
  label: string
  done: boolean
  href?: string
}

const DEFAULT_CONSENT_LABELS: Record<string, string> = {
  "general-treatment": "DPA & General Treatment Consent",
}

export function buildPatientRecordChecklist(params: {
  patient: PatientWithContacts
  medicalHistory: { allergies: string[]; medications: string[]; conditions: string[] } | null
  consents: PatientConsent[]
  patientId: string
  intakeConsentSlugs?: readonly string[]
}): { items: RecordChecklistItem[]; percent: number } {
  const { patient, medicalHistory, consents, patientId, intakeConsentSlugs } = params
  const slugs = normalizeIntakeConsentSlugs(intakeConsentSlugs)
  const consentLabel =
    slugs.length === 1
      ? (DEFAULT_CONSENT_LABELS[slugs[0] ?? ""] ?? slugs[0] ?? "Intake consent")
      : "Intake consent forms"

  const items: RecordChecklistItem[] = [
    {
      id: "profile",
      label: "Profile & contact",
      done: Boolean(
        patient.first_name &&
          patient.last_name &&
          patient.date_of_birth &&
          patient.phone &&
          patient.address
      ),
      href: `/patients/${patientId}/edit`,
    },
    {
      id: "medical",
      label: "Medical history",
      done: Boolean(
        medicalHistory &&
          (medicalHistory.allergies.length > 0 ||
            medicalHistory.conditions.length > 0 ||
            medicalHistory.medications.length > 0)
      ),
      href: `/patients/${patientId}/medical-history`,
    },
    {
      id: "consents",
      label: consentLabel,
      done: findCheckInBlockingConsentSlug(consents, slugs) === null,
      href: `/patients/${patientId}?tab=consents`,
    },
  ]

  const doneCount = items.filter((i) => i.done).length
  const percent = Math.round((doneCount / items.length) * 100)

  return { items, percent }
}
