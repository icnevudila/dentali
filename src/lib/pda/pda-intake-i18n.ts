import {
  PDA_ALLERGY_LABELS,
  PDA_MEDICAL_QUESTION_LABELS,
  type PdaMedicalAllergies,
  type PdaMedicalQuestions,
} from "@/lib/pda/pda-intake-schema"

type Translate = (key: string, fallback: string) => string

export type PdaSectionId = "patient" | "dental" | "medical" | "chart"

export function getPdaSections(t: Translate): { id: PdaSectionId; label: string }[] {
  return [
    { id: "patient", label: t("pda.sectionPatient", "Patient info") },
    { id: "dental", label: t("pda.sectionDental", "Dental history") },
    { id: "medical", label: t("pda.sectionMedical", "Medical history") },
    { id: "chart", label: t("pda.sectionChart", "Chart preview") },
  ]
}

export function getPdaMedicalQuestionLabels(t: Translate) {
  return PDA_MEDICAL_QUESTION_LABELS.map((q) => ({
    ...q,
    label: t(`pda.medical.${q.key}`, q.label),
  }))
}

export function getPdaAllergyLabels(t: Translate) {
  return PDA_ALLERGY_LABELS.map((a) => ({
    ...a,
    label: t(`pda.allergy.${a.key}`, a.label),
  }))
}

export function pdaFieldLabel(t: Translate, key: string, fallback: string) {
  return t(`pda.field.${key}`, fallback)
}

export const PDA_FIELD_KEYS = {
  lastName: "Last name",
  firstName: "First name",
  middleName: "Middle name",
  dateOfBirth: "Birthdate",
  sex: "Sex (M/F)",
  religion: "Religion",
  nationality: "Nationality",
  nickname: "Nickname",
  address: "Home address",
  mobile: "Mobile",
  email: "Email",
  homePhone: "Home phone",
  officePhone: "Office phone",
  fax: "Fax",
  occupation: "Occupation",
  guardianName: "Parent / guardian name",
  guardianOccupation: "Guardian occupation",
  referralSource: "Referral source",
  consultationReason: "Reason for dental consultation",
  previousDentist: "Previous dentist",
  lastDentalVisit: "Last dental visit",
  physicianName: "Physician name",
  physicianSpecialty: "Specialty",
  physicianAddress: "Office address",
  physicianPhone: "Office number",
  bleedingTime: "Bleeding time",
  bloodType: "Blood type",
  bloodPressure: "Blood pressure",
  medications: "Medications",
  notes: "Additional notes",
} as const

export type PdaFieldKey = keyof typeof PDA_FIELD_KEYS

export function getPdaYesNoLabels(t: Translate) {
  return {
    yes: t("pda.yes", "Yes"),
    no: t("pda.no", "No"),
    specify: t("pda.specifyIfYes", "If yes, please specify"),
    fromRecord: t("pda.fromRecord", "From record"),
    allergies: t("pda.allergies", "Allergies"),
    otherAllergies: t("pda.otherAllergies", "Other allergies"),
    chartIntro: t(
      "pda.chartIntro",
      "Chart findings and treatment rows sync from the digital odontogram and treatment plan. They appear on the printed PDA form automatically."
    ),
    activeFindings: t("pda.activeFindings", "Active findings"),
    noFindings: t("pda.noFindings", "No active tooth findings recorded."),
    treatmentRows: t("pda.treatmentRows", "Treatment rows"),
    noTreatmentRows: t("pda.noTreatmentRows", "No treatment timeline entries."),
  }
}

/** Type-only re-exports for consumers that need schema keys. */
export type { PdaMedicalQuestions, PdaMedicalAllergies }
