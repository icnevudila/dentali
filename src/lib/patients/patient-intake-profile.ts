import type { PdaMedicalAllergies, PdaMedicalQuestions } from "@/lib/pda/pda-intake-schema"

/** Extended fields stored on the patient record for PDA / intake prefill. */
export interface PatientIntakeProfile {
  middleName?: string
  religion?: string
  nationality?: string
  nickname?: string
  homePhone?: string
  officePhone?: string
  fax?: string
  occupation?: string
  guardianOccupation?: string
  referralSource?: string
  consultationReason?: string
  previousDentist?: string
  lastDentalVisit?: string
  physicianName?: string
  physicianSpecialty?: string
  physicianAddress?: string
  physicianPhone?: string
  bleedingTime?: string
  bloodType?: string
  bloodPressure?: string
  medicalQuestions?: Partial<PdaMedicalQuestions>
  allergyFlags?: Partial<PdaMedicalAllergies>
  allergyOther?: string
}

export function emptyPatientIntakeProfile(): PatientIntakeProfile {
  return {}
}

export function parsePatientIntakeProfile(raw: unknown): PatientIntakeProfile {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return emptyPatientIntakeProfile()
  }
  const obj = raw as Record<string, unknown>
  const medicalQuestions =
    obj.medicalQuestions && typeof obj.medicalQuestions === "object" && !Array.isArray(obj.medicalQuestions)
      ? (obj.medicalQuestions as Partial<PdaMedicalQuestions>)
      : undefined
  const allergyFlags =
    obj.allergyFlags && typeof obj.allergyFlags === "object" && !Array.isArray(obj.allergyFlags)
      ? (obj.allergyFlags as Partial<PdaMedicalAllergies>)
      : undefined

  return {
    middleName: str(obj.middleName),
    religion: str(obj.religion),
    nationality: str(obj.nationality),
    nickname: str(obj.nickname),
    homePhone: str(obj.homePhone),
    officePhone: str(obj.officePhone),
    fax: str(obj.fax),
    occupation: str(obj.occupation),
    guardianOccupation: str(obj.guardianOccupation),
    referralSource: str(obj.referralSource),
    consultationReason: str(obj.consultationReason),
    previousDentist: str(obj.previousDentist),
    lastDentalVisit: str(obj.lastDentalVisit),
    physicianName: str(obj.physicianName),
    physicianSpecialty: str(obj.physicianSpecialty),
    physicianAddress: str(obj.physicianAddress),
    physicianPhone: str(obj.physicianPhone),
    bleedingTime: str(obj.bleedingTime),
    bloodType: str(obj.bloodType),
    bloodPressure: str(obj.bloodPressure),
    medicalQuestions,
    allergyFlags,
    allergyOther: str(obj.allergyOther),
  }
}

function str(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

/** Strip empty nested objects before persisting. */
export function serializePatientIntakeProfile(profile: PatientIntakeProfile): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(profile)) {
    if (value === undefined || value === null || value === "") continue
    if (typeof value === "object" && !Array.isArray(value)) {
      const nested = Object.fromEntries(
        Object.entries(value).filter(([, v]) => v !== undefined && v !== null && v !== "")
      )
      if (Object.keys(nested).length > 0) out[key] = nested
    } else {
      out[key] = value
    }
  }
  return out
}
