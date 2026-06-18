import type { MedicalHistoryRecord } from "@/lib/patients/medical-history-service"
import type { PdaIntakeResponses } from "@/lib/pda/pda-intake-schema"
import type { ToothFinding } from "@/lib/types/dental"

export function formatPdaDate(value: string | null | undefined): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-PH", { month: "2-digit", day: "2-digit", year: "numeric" })
}

export function getPdaAge(value: string | null | undefined): string {
  if (!value) return ""
  const birthDate = new Date(value)
  if (Number.isNaN(birthDate.getTime())) return ""
  const now = new Date()
  let age = now.getFullYear() - birthDate.getFullYear()
  const monthDelta = now.getMonth() - birthDate.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birthDate.getDate())) age -= 1
  return age > 0 ? String(age) : ""
}

export function pdaGenderLabel(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) return ""
  if (normalized.startsWith("m")) return "M"
  if (normalized.startsWith("f")) return "F"
  return value ?? ""
}

export function pdaToothCode(finding: ToothFinding): string {
  if (finding.condition === "decayed") return "D"
  if (finding.condition === "missing_caries") return "M"
  if (finding.condition === "missing_other") return "MO"
  if (finding.condition === "impacted") return "Im"
  if (finding.condition === "supernumerary") return "Sp"
  if (finding.condition === "root_fragment") return "Rf"
  if (finding.condition === "unerupted") return "Un"
  if (finding.condition === "indicated_extraction") return "X"
  if (finding.restoration_type === "amalgam") return "Am"
  if (finding.restoration_type === "composite") return "Co"
  if (finding.restoration_type === "jacket_crown") return "JC"
  if (finding.restoration_type === "abutment") return "Ab"
  if (finding.restoration_type === "pontic") return "P"
  if (finding.restoration_type === "inlay") return "In"
  if (finding.restoration_type === "implant") return "Imp"
  if (finding.restoration_type === "sealant") return "S"
  if (finding.restoration_type === "removable_denture") return "Rm"
  if (finding.surgery_type === "extraction_caries") return "X"
  if (finding.surgery_type === "extraction_other") return "XO"
  return ""
}

export function textIncludes(items: string[] | undefined, patterns: string[]): boolean {
  const text = (items ?? []).join(" ").toLowerCase()
  return patterns.some((pattern) => text.includes(pattern))
}

export function conditionMatches(
  patterns: string[],
  responses: PdaIntakeResponses | null | undefined,
  medicalHistory?: MedicalHistoryRecord | null
): boolean {
  if (patterns.length === 0) return false
  const haystack = [
    responses?.medical.notes ?? "",
    responses?.medical.medications ?? "",
    ...(medicalHistory?.conditions ?? []),
    ...(medicalHistory?.allergies ?? []),
    medicalHistory?.notes ?? "",
  ]
    .join(" ")
    .toLowerCase()
  return patterns.some((p) => haystack.includes(p))
}

export function formatPdaName(
  responses: PdaIntakeResponses | null | undefined,
  fallback?: { last_name?: string; first_name?: string } | null
): string {
  const p = responses?.patient
  if (p?.lastName || p?.firstName) {
    return `${p.lastName}, ${p.firstName}${p.middleName ? ` ${p.middleName}` : ""}`.trim()
  }
  if (fallback?.last_name || fallback?.first_name) {
    return `${fallback.last_name ?? ""}, ${fallback.first_name ?? ""}`.trim()
  }
  return ""
}

export function formatPdaPeso(value: number | null | undefined): string {
  if (!value) return ""
  return value.toLocaleString("en-PH", { maximumFractionDigits: 0 })
}
