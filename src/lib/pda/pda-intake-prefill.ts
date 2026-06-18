import type { PatientRecord, PatientWithContacts } from "@/lib/patients/patient-service"
import type { PatientIntakeProfile } from "@/lib/patients/patient-intake-profile"
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

function pickYesNo(stored: PdaYesNo | undefined, inferred: PdaYesNo): PdaYesNo {
  if (stored === "yes" || stored === "no") return stored
  return inferred
}

function dateOnly(iso: string | null | undefined): string {
  if (!iso) return ""
  return iso.slice(0, 10)
}

function applyIntakeProfile(base: PdaIntakeResponses, profile: PatientIntakeProfile) {
  const p = profile
  if (p.middleName) base.patient.middleName = p.middleName
  if (p.religion) base.patient.religion = p.religion
  if (p.nationality) base.patient.nationality = p.nationality
  if (p.nickname) base.patient.nickname = p.nickname
  if (p.homePhone) base.patient.homePhone = p.homePhone
  if (p.officePhone) base.patient.officePhone = p.officePhone
  if (p.fax) base.patient.fax = p.fax
  if (p.occupation) base.patient.occupation = p.occupation
  if (p.guardianOccupation) base.patient.guardianOccupation = p.guardianOccupation
  if (p.referralSource) base.patient.referralSource = p.referralSource
  if (p.consultationReason) base.patient.consultationReason = p.consultationReason
  if (p.previousDentist) base.dental.previousDentist = p.previousDentist
  if (p.lastDentalVisit) base.dental.lastDentalVisit = p.lastDentalVisit
  if (p.physicianName) base.medical.physicianName = p.physicianName
  if (p.physicianSpecialty) base.medical.physicianSpecialty = p.physicianSpecialty
  if (p.physicianAddress) base.medical.physicianAddress = p.physicianAddress
  if (p.physicianPhone) base.medical.physicianPhone = p.physicianPhone
  if (p.allergyOther) base.medical.allergyOther = p.allergyOther
  if (p.bleedingTime) base.medical.bleedingTime = p.bleedingTime
  if (p.bloodType) base.medical.bloodType = p.bloodType
  if (p.bloodPressure) base.medical.bloodPressure = p.bloodPressure

  if (p.medicalQuestions) {
    base.medical.questions = { ...base.medical.questions, ...p.medicalQuestions }
  }
  if (p.allergyFlags) {
    base.medical.allergies = { ...base.medical.allergies, ...p.allergyFlags }
  }
}

function inferMedicalFromHistory(
  base: PdaIntakeResponses,
  medicalHistory: MedicalHistoryRecord,
  profile?: PatientIntakeProfile
) {
  const storedQ = profile?.medicalQuestions ?? {}
  const storedA = profile?.allergyFlags ?? {}
  const q = base.medical.questions
  const a = base.medical.allergies

  q.hypertension = pickYesNo(
    storedQ.hypertension,
    toYesNo(textIncludes(medicalHistory.conditions, ["high blood", "hypertension"]))
  )
  q.hypotension = pickYesNo(
    storedQ.hypotension,
    toYesNo(textIncludes(medicalHistory.conditions, ["low blood", "hypotension"]))
  )
  q.epilepsy = pickYesNo(
    storedQ.epilepsy,
    toYesNo(textIncludes(medicalHistory.conditions, ["epilepsy", "convulsion"]))
  )
  q.heart_disease = pickYesNo(
    storedQ.heart_disease,
    toYesNo(textIncludes(medicalHistory.conditions, ["heart"]))
  )
  q.hepatitis = pickYesNo(
    storedQ.hepatitis,
    toYesNo(textIncludes(medicalHistory.conditions, ["hepatitis", "liver"]))
  )
  q.diabetes = pickYesNo(
    storedQ.diabetes,
    toYesNo(textIncludes(medicalHistory.conditions, ["diabetes"]))
  )
  q.cancer = pickYesNo(
    storedQ.cancer,
    toYesNo(textIncludes(medicalHistory.conditions, ["cancer", "tumor"]))
  )
  q.asthma = pickYesNo(
    storedQ.asthma,
    toYesNo(textIncludes(medicalHistory.conditions, ["asthma"]))
  )
  q.taking_medication = pickYesNo(
    storedQ.taking_medication,
    medicalHistory.medications.length > 0 ? "yes" : ""
  )
  q.serious_illness = pickYesNo(
    storedQ.serious_illness,
    toYesNo(
      textIncludes(medicalHistory.conditions, [
        "surgery",
        "surgical",
        "serious illness",
        "operation",
      ])
    )
  )
  q.hospitalized = pickYesNo(
    storedQ.hospitalized,
    toYesNo(textIncludes(medicalHistory.conditions, ["hospital"]))
  )
  q.under_treatment = pickYesNo(
    storedQ.under_treatment,
    toYesNo(textIncludes(medicalHistory.conditions, ["treatment", "therapy"]))
  )

  if (!q.under_treatment_detail?.trim() && storedQ.under_treatment_detail) {
    q.under_treatment_detail = storedQ.under_treatment_detail
  }
  if (!q.serious_illness_detail?.trim() && storedQ.serious_illness_detail) {
    q.serious_illness_detail = storedQ.serious_illness_detail
  }
  if (!q.hospitalized_detail?.trim() && storedQ.hospitalized_detail) {
    q.hospitalized_detail = storedQ.hospitalized_detail
  }
  if (storedQ.good_health) q.good_health = storedQ.good_health

  a.lidocaine = pickYesNo(
    storedA.lidocaine,
    toYesNo(textIncludes(medicalHistory.allergies, ["lidocaine", "local anesthetic", "anesthetic"]))
  )
  a.penicillin = pickYesNo(
    storedA.penicillin,
    toYesNo(textIncludes(medicalHistory.allergies, ["penicillin", "antibiotic"]))
  )
  a.sulfa = pickYesNo(storedA.sulfa, toYesNo(textIncludes(medicalHistory.allergies, ["sulfa"])))
  a.aspirin = pickYesNo(storedA.aspirin, toYesNo(textIncludes(medicalHistory.allergies, ["aspirin"])))
  a.latex = pickYesNo(storedA.latex, toYesNo(textIncludes(medicalHistory.allergies, ["latex"])))

  base.medical.medications = medicalHistory.medications.join(", ")
  base.medical.notes = medicalHistory.notes ?? ""

  if (!base.medical.allergyOther?.trim()) {
    const known = new Set([
      "lidocaine",
      "local anesthetic",
      "anesthetic",
      "penicillin",
      "antibiotic",
      "sulfa",
      "aspirin",
      "latex",
    ])
    const other = medicalHistory.allergies.filter(
      (item) => !known.has(item.toLowerCase()) && item.trim().length > 0
    )
    if (other.length > 0) {
      base.medical.allergyOther = other.join(", ")
    }
  }
}

export function buildPdaIntakePrefill(params: {
  patient: PatientRecord | PatientWithContacts | null
  medicalHistory?: MedicalHistoryRecord | null
  lastClinicVisit?: string | null
}): PdaIntakeResponses {
  const base = emptyPdaIntakeResponses()
  const { patient, medicalHistory, lastClinicVisit } = params
  if (!patient) return base

  const profile =
    "intake_profile" in patient && patient.intake_profile
      ? patient.intake_profile
      : ({} as PatientIntakeProfile)

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
  }
  if (emergency?.phone) {
    base.patient.homePhone = base.patient.homePhone || emergency.phone
  }

  applyIntakeProfile(base, profile)

  if (!base.dental.lastDentalVisit && lastClinicVisit) {
    base.dental.lastDentalVisit = dateOnly(lastClinicVisit)
  }

  if (medicalHistory) {
    inferMedicalFromHistory(base, medicalHistory, profile)
  } else if (profile.medicalQuestions || profile.allergyFlags) {
    if (profile.medicalQuestions) {
      base.medical.questions = { ...base.medical.questions, ...profile.medicalQuestions }
    }
    if (profile.allergyFlags) {
      base.medical.allergies = { ...base.medical.allergies, ...profile.allergyFlags }
    }
    if (profile.allergyOther) base.medical.allergyOther = profile.allergyOther
  }

  return base
}

export function listPdaPrefillKeys(prefill: PdaIntakeResponses): Set<string> {
  const keys = new Set<string>()
  const walk = (obj: Record<string, unknown>, prefix: string) => {
    for (const [k, v] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${k}` : k
      if (typeof v === "string" && v.trim()) keys.add(path)
      else if (v && typeof v === "object" && !Array.isArray(v)) {
        walk(v as Record<string, unknown>, path)
      }
    }
  }
  walk(prefill as unknown as Record<string, unknown>, "")
  return keys
}

export function intakeProfileFromPdaPrefill(prefill: PdaIntakeResponses): PatientIntakeProfile {
  return {
    middleName: prefill.patient.middleName || undefined,
    religion: prefill.patient.religion || undefined,
    nationality: prefill.patient.nationality || undefined,
    nickname: prefill.patient.nickname || undefined,
    homePhone: prefill.patient.homePhone || undefined,
    officePhone: prefill.patient.officePhone || undefined,
    fax: prefill.patient.fax || undefined,
    occupation: prefill.patient.occupation || undefined,
    guardianOccupation: prefill.patient.guardianOccupation || undefined,
    referralSource: prefill.patient.referralSource || undefined,
    consultationReason: prefill.patient.consultationReason || undefined,
    previousDentist: prefill.dental.previousDentist || undefined,
    lastDentalVisit: prefill.dental.lastDentalVisit || undefined,
    physicianName: prefill.medical.physicianName || undefined,
    physicianSpecialty: prefill.medical.physicianSpecialty || undefined,
    physicianAddress: prefill.medical.physicianAddress || undefined,
    physicianPhone: prefill.medical.physicianPhone || undefined,
    bleedingTime: prefill.medical.bleedingTime || undefined,
    bloodType: prefill.medical.bloodType || undefined,
    bloodPressure: prefill.medical.bloodPressure || undefined,
    allergyOther: prefill.medical.allergyOther || undefined,
    medicalQuestions: prefill.medical.questions,
    allergyFlags: prefill.medical.allergies,
  }
}
