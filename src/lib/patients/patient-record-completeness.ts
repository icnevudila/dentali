import type { PatientWithContacts } from "@/lib/patients/patient-service"
import type { PatientConsent } from "@/lib/patients/consent-service"

export type RecordChecklistItem = {
  id: string
  label: string
  done: boolean
  href?: string
}

export function buildPatientRecordChecklist(params: {
  patient: PatientWithContacts
  medicalHistory: { allergies: string[]; medications: string[]; conditions: string[] } | null
  consents: PatientConsent[]
  patientId: string
}): { items: RecordChecklistItem[]; percent: number } {
  const { patient, medicalHistory, consents, patientId } = params

  const hasSigned = (slug: string) =>
    consents.some((c) => c.template_slug === slug && c.status === "signed")

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
      id: "general",
      label: "DPA & General Treatment Consent",
      done: hasSigned("general-treatment"),
      href: `/patients/${patientId}?tab=consents`,
    },
  ]

  const doneCount = items.filter((i) => i.done).length
  const percent = Math.round((doneCount / items.length) * 100)

  return { items, percent }
}
