import { PERMISSIONS, type PermissionKey } from "@/lib/auth/permissions"

export const ROLE_LABEL_KEYS: Record<string, string> = {
  owner: "settings.roleOwner",
  admin: "settings.roleAdmin",
  dentist: "settings.roleDentist",
  assistant: "settings.roleAssistant",
  receptionist: "settings.roleReceptionist",
}

export const ROLE_LABEL_FALLBACKS: Record<string, string> = {
  owner: "Owner",
  admin: "Clinic administrator",
  dentist: "Dentist",
  assistant: "Dental assistant",
  receptionist: "Receptionist",
}

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  [PERMISSIONS.PATIENTS_READ]: "View patients",
  [PERMISSIONS.PATIENTS_WRITE]: "Register and edit patients",
  [PERMISSIONS.MEDICAL_HISTORY_READ]: "View medical history",
  [PERMISSIONS.MEDICAL_HISTORY_WRITE]: "Edit medical history",
  [PERMISSIONS.CONSENTS_MANAGE]: "Manage consent forms",
  [PERMISSIONS.DENTAL_CHART_READ]: "View dental chart",
  [PERMISSIONS.DENTAL_CHART_WRITE]: "Edit dental chart",
  [PERMISSIONS.APPOINTMENTS_READ]: "View appointments",
  [PERMISSIONS.APPOINTMENTS_WRITE]: "Book and manage appointments",
  [PERMISSIONS.QUEUE_MANAGE]: "Manage queue board",
  [PERMISSIONS.BILLING_READ]: "View billing and invoices",
  [PERMISSIONS.BILLING_WRITE]: "Create invoices and record payments",
  [PERMISSIONS.HMO_READ]: "View HMO claims",
  [PERMISSIONS.HMO_WRITE]: "Manage HMO claims",
  [PERMISSIONS.STAFF_MANAGE]: "Manage staff and assignments",
  [PERMISSIONS.SETTINGS_MANAGE]: "Manage clinic settings",
  [PERMISSIONS.NOTIFICATIONS_READ]: "View notifications",
  [PERMISSIONS.NOTIFICATIONS_WRITE]: "Send notifications",
  [PERMISSIONS.AUDIT_READ]: "View audit log",
  [PERMISSIONS.COMPLIANCE_READ]: "View compliance records",
  [PERMISSIONS.COMPLIANCE_WRITE]: "Manage compliance records",
  [PERMISSIONS.PRESCRIPTIONS_READ]: "View prescriptions",
  [PERMISSIONS.PRESCRIPTIONS_WRITE]: "Create and sign prescriptions",
}

export const PERMISSION_GROUPS: { id: string; labelKey: string; labelFallback: string; permissions: PermissionKey[] }[] =
  [
    {
      id: "patients",
      labelKey: "settings.permGroupPatients",
      labelFallback: "Patients",
      permissions: [
        PERMISSIONS.PATIENTS_READ,
        PERMISSIONS.PATIENTS_WRITE,
        PERMISSIONS.MEDICAL_HISTORY_READ,
        PERMISSIONS.MEDICAL_HISTORY_WRITE,
        PERMISSIONS.CONSENTS_MANAGE,
      ],
    },
    {
      id: "clinical",
      labelKey: "settings.permGroupClinical",
      labelFallback: "Clinical",
      permissions: [
        PERMISSIONS.DENTAL_CHART_READ,
        PERMISSIONS.DENTAL_CHART_WRITE,
        PERMISSIONS.PRESCRIPTIONS_READ,
        PERMISSIONS.PRESCRIPTIONS_WRITE,
      ],
    },
    {
      id: "scheduling",
      labelKey: "settings.permGroupScheduling",
      labelFallback: "Scheduling & queue",
      permissions: [
        PERMISSIONS.APPOINTMENTS_READ,
        PERMISSIONS.APPOINTMENTS_WRITE,
        PERMISSIONS.QUEUE_MANAGE,
      ],
    },
    {
      id: "billing",
      labelKey: "settings.permGroupBilling",
      labelFallback: "Billing & claims",
      permissions: [
        PERMISSIONS.BILLING_READ,
        PERMISSIONS.BILLING_WRITE,
        PERMISSIONS.HMO_READ,
        PERMISSIONS.HMO_WRITE,
      ],
    },
    {
      id: "admin",
      labelKey: "settings.permGroupAdmin",
      labelFallback: "Administration",
      permissions: [
        PERMISSIONS.STAFF_MANAGE,
        PERMISSIONS.SETTINGS_MANAGE,
        PERMISSIONS.NOTIFICATIONS_READ,
        PERMISSIONS.NOTIFICATIONS_WRITE,
        PERMISSIONS.AUDIT_READ,
        PERMISSIONS.COMPLIANCE_READ,
        PERMISSIONS.COMPLIANCE_WRITE,
      ],
    },
  ]

/** Roles clinic admins may edit (owner role is always locked). */
export function isRoleEditable(roleName: string, callerIsOwner: boolean): boolean {
  if (roleName === "owner") return false
  if (roleName === "admin") return callerIsOwner
  return true
}
