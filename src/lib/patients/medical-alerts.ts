export interface MedicalAlertsData {
  allergies: string[]
  conditions: string[]
  medications: string[]
}

export function hasMedicalAlerts(data: MedicalAlertsData | null | undefined): boolean {
  if (!data) return false
  return data.allergies.length > 0 || data.conditions.length > 0
}

export function formatMedicalAlertLabel(data: MedicalAlertsData): string | null {
  const parts: string[] = []
  if (data.allergies.length > 0) {
    parts.push(`${data.allergies.length === 1 ? "Allergy" : "Allergies"}: ${data.allergies.join(", ")}`)
  }
  if (data.conditions.length > 0) {
    parts.push(`${data.conditions.length === 1 ? "Condition" : "Conditions"}: ${data.conditions.join(", ")}`)
  }
  return parts.length > 0 ? parts.join(" · ") : null
}

export function toMedicalAlertsData(record: {
  allergies: string[]
  conditions: string[]
  medications?: string[]
}): MedicalAlertsData {
  return {
    allergies: record.allergies.filter(Boolean),
    conditions: record.conditions.filter(Boolean),
    medications: record.medications?.filter(Boolean) ?? [],
  }
}
