import type { ConsentField, ConsentFieldResponses } from "./consent-field-types"

export type ConsentTemplateVariables = Record<string, string>

const BUILTIN_VARIABLES = [
  "patient_name",
  "patient_dob",
  "clinic_name",
  "org_name",
  "branch_name",
  "today_date",
] as const

export function buildConsentVariables(params: {
  patientName?: string
  patientDob?: string
  clinicName?: string
  orgName?: string
  branchName?: string
}): ConsentTemplateVariables {
  return {
    patient_name: params.patientName ?? "",
    patient_dob: params.patientDob ?? "",
    clinic_name: params.clinicName ?? params.orgName ?? "",
    org_name: params.orgName ?? "",
    branch_name: params.branchName ?? "",
    today_date: new Date().toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  }
}

export function interpolateConsentBody(body: string, variables: ConsentTemplateVariables): string {
  let out = body
  for (const [key, value] of Object.entries(variables)) {
    out = out.replaceAll(`{{${key}}}`, value)
  }
  return out
}

export function formatFieldResponseForDisplay(
  field: ConsentField,
  value: string | boolean | undefined
): string {
  if (value === undefined || value === "") return "—"
  if (field.type === "checkbox") return value === true ? "Yes" : "No"
  if (field.type === "yes_no") return value === "yes" ? "Yes" : value === "no" ? "No" : "—"
  return String(value)
}

export function interpolateConsentFields(
  fields: ConsentField[],
  variables: ConsentTemplateVariables
): ConsentField[] {
  return fields.map((field) =>
    field.type === "paragraph"
      ? { ...field, label: interpolateConsentBody(field.label, variables) }
      : field
  )
}

export function buildConsentDocumentSections(params: {
  body: string
  variables: ConsentTemplateVariables
  fields: ConsentField[]
  responses: ConsentFieldResponses
}): { narrative: string; fieldLines: { label: string; value: string }[] } {
  const narrative = interpolateConsentBody(params.body, params.variables)
  const fieldLines = params.fields
    .filter((f) => f.type !== "paragraph")
    .map((f) => ({
      label: f.label,
      value: formatFieldResponseForDisplay(f, params.responses[f.id]),
    }))
    .filter((line) => line.value !== "—")
  return { narrative, fieldLines }
}

/** Immutable snapshot stored on sign — narrative + completed field answers. */
export function buildConsentBodySnapshot(params: {
  body: string
  variables: ConsentTemplateVariables
  fields: ConsentField[]
  responses: ConsentFieldResponses
}): string {
  const { narrative, fieldLines } = buildConsentDocumentSections(params)
  const parts: string[] = []

  if (narrative.trim()) parts.push(narrative.trim())

  if (fieldLines.length > 0) {
    parts.push(
      fieldLines.map((line) => `${line.label}: ${line.value}`).join("\n")
    )
  }

  return parts.join("\n\n")
}

export const PREVIEW_CONSENT_VARIABLES: ConsentTemplateVariables = {
  patient_name: "Maria Santos",
  patient_dob: "1990-03-15",
  clinic_name: "Smile Dental QC",
  org_name: "Smile Dental Group",
  branch_name: "Quezon City Branch",
  today_date: new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }),
}

export { BUILTIN_VARIABLES }
