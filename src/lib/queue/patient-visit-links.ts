/** Doctor-facing links into the active patient visit workspace. */
export function patientVisitWorkspaceHref(patientId: string) {
  return `/patients/${patientId}?tab=clinical-notes&visit=active`
}

export function patientChartHref(patientId: string) {
  return `/patients/${patientId}/chart`
}

export function patientTreatmentPlanHref(patientId: string, encounterId?: string | null) {
  if (encounterId) return `/patients/${patientId}/treatment-plan?encounter=${encounterId}`
  return `/patients/${patientId}/treatment-plan`
}

export function patientVisitsLogHref(patientId: string) {
  return `/patients/${patientId}/visits`
}
