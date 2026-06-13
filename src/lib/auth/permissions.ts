/** Permission keys — source: docs/08_BACKEND_ARCHITECTURE.md */
export const PERMISSIONS = {
  PATIENTS_READ: "patients.read",
  PATIENTS_WRITE: "patients.write",
  MEDICAL_HISTORY_READ: "patients.medical_history.read",
  MEDICAL_HISTORY_WRITE: "patients.medical_history.write",
  CONSENTS_MANAGE: "consents.manage",
  DENTAL_CHART_READ: "dental_chart.read",
  DENTAL_CHART_WRITE: "dental_chart.write",
  APPOINTMENTS_READ: "appointments.read",
  APPOINTMENTS_WRITE: "appointments.write",
  QUEUE_MANAGE: "queue.manage",
  BILLING_READ: "billing.read",
  BILLING_WRITE: "billing.write",
  HMO_READ: "hmo.read",
  HMO_WRITE: "hmo.write",
  STAFF_MANAGE: "staff.manage",
  SETTINGS_MANAGE: "settings.manage",
  NOTIFICATIONS_READ: "notifications.read",
  NOTIFICATIONS_WRITE: "notifications.write",
  AUDIT_READ: "audit.read",
  COMPLIANCE_READ: "compliance.read",
  COMPLIANCE_WRITE: "compliance.write",
} as const

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

export interface BranchRecord {
  id: string
  name: string
  organization_id: string
  address: string | null
  contact_number: string | null
  is_active: boolean
  role_name: string
}

export interface OrganizationRecord {
  id: string
  name: string
  logo_url: string | null
  timezone: string | null
  address: string | null
  contact_number: string | null
  slug?: string | null
  status?: "active" | "suspended" | "trial"
  plan_tier?: "trial" | "standard" | "enterprise"
}

export interface RoleWithPermissions {
  id: string
  name: string
  description: string | null
  permissions: string[]
}
