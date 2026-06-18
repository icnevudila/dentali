export type PdaYesNo = "yes" | "no" | ""

export interface PdaPatientSection {
  lastName: string
  firstName: string
  middleName: string
  dateOfBirth: string
  sex: string
  religion: string
  nationality: string
  nickname: string
  address: string
  homePhone: string
  officePhone: string
  fax: string
  mobile: string
  email: string
  occupation: string
  guardianName: string
  guardianOccupation: string
  referralSource: string
  consultationReason: string
}

export interface PdaDentalSection {
  previousDentist: string
  lastDentalVisit: string
}

export interface PdaMedicalAllergies {
  lidocaine: PdaYesNo
  penicillin: PdaYesNo
  sulfa: PdaYesNo
  aspirin: PdaYesNo
  latex: PdaYesNo
}

export interface PdaMedicalQuestions {
  good_health: PdaYesNo
  under_treatment: PdaYesNo
  under_treatment_detail: string
  serious_illness: PdaYesNo
  serious_illness_detail: string
  hospitalized: PdaYesNo
  hospitalized_detail: string
  taking_medication: PdaYesNo
  hypertension: PdaYesNo
  hypotension: PdaYesNo
  epilepsy: PdaYesNo
  heart_disease: PdaYesNo
  hepatitis: PdaYesNo
  diabetes: PdaYesNo
  cancer: PdaYesNo
  asthma: PdaYesNo
}

export interface PdaMedicalSection {
  physicianName: string
  physicianSpecialty: string
  physicianAddress: string
  physicianPhone: string
  questions: PdaMedicalQuestions
  allergies: PdaMedicalAllergies
  allergyOther: string
  medications: string
  notes: string
  bleedingTime: string
  bloodType: string
  bloodPressure: string
}

export interface PdaIntakeResponses {
  patient: PdaPatientSection
  dental: PdaDentalSection
  medical: PdaMedicalSection
}

export type PdaIntakeStatus = "draft" | "patient_pending" | "completed"

export const PDA_MEDICAL_QUESTION_LABELS: { key: keyof PdaMedicalQuestions; label: string; detailKey?: keyof PdaMedicalQuestions }[] = [
  { key: "good_health", label: "Are you in good health?" },
  { key: "under_treatment", label: "Are you under medical treatment now?", detailKey: "under_treatment_detail" },
  { key: "serious_illness", label: "Have you ever had serious illness or surgical operation?", detailKey: "serious_illness_detail" },
  { key: "hospitalized", label: "Have you ever been hospitalized?", detailKey: "hospitalized_detail" },
  { key: "taking_medication", label: "Are you taking any prescription/non-prescription medication?" },
  { key: "hypertension", label: "High blood pressure?" },
  { key: "hypotension", label: "Low blood pressure?" },
  { key: "epilepsy", label: "Epilepsy / convulsions?" },
  { key: "heart_disease", label: "Heart disease?" },
  { key: "hepatitis", label: "Hepatitis / liver disease?" },
  { key: "diabetes", label: "Diabetes?" },
  { key: "cancer", label: "Cancer / tumor?" },
  { key: "asthma", label: "Asthma?" },
]

export const PDA_ALLERGY_LABELS: { key: keyof PdaMedicalAllergies; label: string }[] = [
  { key: "lidocaine", label: "Local anesthetic (lidocaine)" },
  { key: "penicillin", label: "Penicillin / antibiotics" },
  { key: "sulfa", label: "Sulfa drugs" },
  { key: "aspirin", label: "Aspirin" },
  { key: "latex", label: "Latex" },
]

export function emptyPdaMedicalQuestions(): PdaMedicalQuestions {
  return {
    good_health: "",
    under_treatment: "",
    under_treatment_detail: "",
    serious_illness: "",
    serious_illness_detail: "",
    hospitalized: "",
    hospitalized_detail: "",
    taking_medication: "",
    hypertension: "",
    hypotension: "",
    epilepsy: "",
    heart_disease: "",
    hepatitis: "",
    diabetes: "",
    cancer: "",
    asthma: "",
  }
}

export function emptyPdaIntakeResponses(): PdaIntakeResponses {
  return {
    patient: {
      lastName: "",
      firstName: "",
      middleName: "",
      dateOfBirth: "",
      sex: "",
      religion: "",
      nationality: "",
      nickname: "",
      address: "",
      homePhone: "",
      officePhone: "",
      fax: "",
      mobile: "",
      email: "",
      occupation: "",
      guardianName: "",
      guardianOccupation: "",
      referralSource: "",
      consultationReason: "",
    },
    dental: {
      previousDentist: "",
      lastDentalVisit: "",
    },
    medical: {
      physicianName: "",
      physicianSpecialty: "",
      physicianAddress: "",
      physicianPhone: "",
      questions: emptyPdaMedicalQuestions(),
      allergies: {
        lidocaine: "",
        penicillin: "",
        sulfa: "",
        aspirin: "",
        latex: "",
      },
      allergyOther: "",
      medications: "",
      notes: "",
      bleedingTime: "",
      bloodType: "",
      bloodPressure: "",
    },
  }
}

export function parsePdaIntakeResponses(raw: unknown): PdaIntakeResponses {
  const base = emptyPdaIntakeResponses()
  if (!raw || typeof raw !== "object") return base
  const obj = raw as Record<string, unknown>
  const patient = (obj.patient ?? {}) as Record<string, unknown>
  const dental = (obj.dental ?? {}) as Record<string, unknown>
  const medical = (obj.medical ?? {}) as Record<string, unknown>
  const questions = (medical.questions ?? {}) as Record<string, unknown>
  const allergies = (medical.allergies ?? {}) as Record<string, unknown>

  return {
    patient: { ...base.patient, ...patient } as PdaPatientSection,
    dental: { ...base.dental, ...dental } as PdaDentalSection,
    medical: {
      ...base.medical,
      ...medical,
      questions: { ...base.medical.questions, ...questions } as PdaMedicalQuestions,
      allergies: { ...base.medical.allergies, ...allergies } as PdaMedicalAllergies,
    },
  }
}

export function mergePdaIntakeResponses(
  saved: PdaIntakeResponses,
  prefill: PdaIntakeResponses
): PdaIntakeResponses {
  const pick = <T extends Record<string, unknown>>(base: T, overlay: T): T => {
    const out = { ...base }
    for (const key of Object.keys(overlay) as (keyof T)[]) {
      const val = overlay[key]
      if (typeof val === "object" && val !== null && !Array.isArray(val)) {
        out[key] = pick(
          (base[key] ?? {}) as Record<string, unknown>,
          val as Record<string, unknown>
        ) as T[keyof T]
      } else if (typeof val === "string" && val.trim() && !(typeof base[key] === "string" && (base[key] as string).trim())) {
        out[key] = val
      }
    }
    return out
  }
  return pick(saved as unknown as Record<string, unknown>, prefill as unknown as Record<string, unknown>) as unknown as PdaIntakeResponses
}
