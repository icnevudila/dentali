export type ConsentFieldType =
  | "text"
  | "date"
  | "checkbox"
  | "yes_no"
  | "initials"
  | "select"
  | "paragraph"

export interface ConsentField {
  id: string
  type: ConsentFieldType
  label: string
  required?: boolean
  placeholder?: string
  options?: string[]
  helpText?: string
}

export type ConsentFieldResponses = Record<string, string | boolean>

export const DEFAULT_GENERAL_TREATMENT_FIELDS: ConsentField[] = [
  {
    id: "emergency_contact",
    type: "text",
    label: "Emergency contact name & number",
    required: true,
    placeholder: "Name, phone",
  },
  {
    id: "procedure_acknowledged",
    type: "yes_no",
    label: "I understand the proposed treatment and alternatives were explained",
    required: true,
  },
  {
    id: "questions_answered",
    type: "checkbox",
    label: "I had the opportunity to ask questions and they were answered",
    required: true,
  },
  {
    id: "patient_initials",
    type: "initials",
    label: "Patient initials",
    required: true,
    placeholder: "e.g. MS",
  },
]

export function parseConsentFields(raw: unknown): ConsentField[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (f): f is ConsentField =>
      f &&
      typeof f === "object" &&
      typeof (f as ConsentField).id === "string" &&
      typeof (f as ConsentField).type === "string" &&
      typeof (f as ConsentField).label === "string"
  )
}

export function isConsentFieldComplete(
  field: ConsentField,
  value: string | boolean | undefined
): boolean {
  if (field.type === "paragraph") return true
  if (field.type === "checkbox") return value === true
  if (field.type === "yes_no") return value === "yes" || value === "no"
  return typeof value === "string" && value.trim().length > 0
}

export function countConsentFieldProgress(
  fields: ConsentField[],
  responses: ConsentFieldResponses
): { completed: number; required: number } {
  const required = fields.filter((f) => f.required && f.type !== "paragraph")
  const completed = required.filter((f) => isConsentFieldComplete(f, responses[f.id])).length
  return { completed, required: required.length }
}

export function validateConsentResponses(
  fields: ConsentField[],
  responses: ConsentFieldResponses
): string | null {
  for (const field of fields) {
    if (!field.required) continue
    const v = responses[field.id]
    if (field.type === "checkbox") {
      if (v !== true) return `"${field.label}" is required`
      continue
    }
    if (field.type === "yes_no") {
      if (v !== "yes" && v !== "no") return `"${field.label}" is required`
      continue
    }
    if (typeof v !== "string" || !v.trim()) return `"${field.label}" is required`
  }
  return null
}
