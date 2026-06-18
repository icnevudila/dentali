import type { PatientRecord, PatientWithContacts } from "@/lib/patients/patient-service"
import type { MedicalHistoryRecord } from "@/lib/patients/medical-history-service"
import {
  emptyPdaIntakeResponses,
  type PdaIntakeResponses,
  type PdaYesNo,
} from "@/lib/pda/pda-intake-schema"

function textIncludes(items: string[] | undefined, patterns: string[]): boolean {
  const text = (items ?? []).join(" ").toLowerCase()
  return patterns.some((pattern) => text.includes(pattern))
}

function genderToSex(gender: string | null | undefined): string {
  const normalized = gender?.trim().toLowerCase() ?? ""
  if (normalized.startsWith("m")) return "M"
  if (normalized.startsWith("f")) return "F"
  return gender ?? ""
}

function toYesNo(match: boolean): PdaYesNo {
  return match ? "yes" : ""
}

export function buildPdaIntakePrefill(params: {
  patient: PatientRecord | PatientWithContacts | null
  medicalHistory?: MedicalHistoryRecord | null
}): PdaIntakeResponses {
  const base = emptyPdaIntakeResponses()
  const { patient, medicalHistory } = params
  if (!patient) return base

  base.patient.lastName = patient.last_name ?? ""
  base.patient.firstName = patient.first_name ?? ""
  base.patient.dateOfBirth = patient.date_of_birth ?? ""
  base.patient.sex = genderToSex(patient.gender)
  base.patient.address = patient.address ?? ""
  base.patient.mobile = patient.phone ?? ""
  base.patient.email = patient.email ?? ""

  const emergency = "emergency_contact" in patient ? patient.emergency_contact : null
  if (emergency?.name) {
    base.patient.guardianName = emergency.name
    if (emergency.phone) base.patient.homePhone = emergency.phone
  }

  if (medicalHistory) {
    base.medical.medications = medicalHistory.medications.join(", ")
    base.medical.notes = medicalHistory.notes ?? ""
    base.medical.allergies.lidocaine = toYesNo(
      textIncludes(medicalHistory.allergies, ["lidocaine", "local anesthetic", "anesthetic"])
    )
    base.medical.allergies.penicillin = toYesNo(
      textIncludes(medicalHistory.allergies, ["penicillin", "antibiotic"])
    )
    base.medical.allergies.sulfa = toYesNo(textIncludes(medicalHistory.allergies, ["sulfa"]))
    base.medical.allergies.aspirin = toYesNo(textIncludes(medicalHistory.allergies, ["aspirin"]))
    base.medical.allergies.latex = toYesNo(textIncludes(medicalHistory.allergies, ["latex"]))
    base.medical.questions.hypertension = toYesNo(
      textIncludes(medicalHistory.conditions, ["high blood", "hypertension"])
    )
    base.medical.questions.hypotension = toYesNo(
      textIncludes(medicalHistory.conditions, ["low blood", "hypotension"])
    )
    base.medical.questions.epilepsy = toYesNo(
      textIncludes(medicalHistory.conditions, ["epilepsy", "convulsion"])
    )
    base.medical.questions.heart_disease = toYesNo(
      textIncludes(medicalHistory.conditions, ["heart"])
    )
    base.medical.questions.hepatitis = toYesNo(
      textIncludes(medicalHistory.conditions, ["hepatitis", "liver"])
    )
    base.medical.questions.diabetes = toYesNo(textIncludes(medicalHistory.conditions, ["diabetes"]))
    base.medical.questions.cancer = toYesNo(
      textIncludes(medicalHistory.conditions, ["cancer", "tumor"])
    )
    base.medical.questions.asthma = toYesNo(textIncludes(medicalHistory.conditions, ["asthma"]))
    base.medical.questions.taking_medication = medicalHistory.medications.length > 0 ? "yes" : ""
  }

  return base
}
