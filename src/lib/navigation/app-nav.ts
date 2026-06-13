import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  Bell,
  Calendar,
  Clock,
  CreditCard,
  FileCheck2,
  Home,
  ListOrdered,
  Monitor,
  Package,
  PieChart,
  Settings,
  Shield,
  Tablet,
  UserPlus,
  Users,
} from "lucide-react"
import { PERMISSIONS, type PermissionKey } from "@/lib/auth/permissions"

export type AppNavItem = {
  nameKey: string
  fallback: string
  href: string
  icon: LucideIcon
  permission?: PermissionKey
  openInNewTab?: boolean
  /** Staff sidebar: generate branch token and open patient-facing device URL */
  publicDevice?: "kiosk" | "display"
  isActive?: (pathname: string) => boolean
}

export type AppNavGroup = {
  id: string
  labelKey: string
  labelFallback: string
  items: AppNavItem[]
}

function billingInvoicesActive(pathname: string) {
  if (pathname === "/billing") return true
  if (!pathname.startsWith("/billing/")) return false
  return !pathname.startsWith("/billing/hmo") && !pathname.startsWith("/billing/philhealth")
}

function settingsHubActive(pathname: string) {
  const hubPrefixes = [
    "/settings/organization",
    "/settings/branches",
    "/settings/roles",
    "/settings/procedures",
    "/settings/consent-templates",
  ]
  return hubPrefixes.some((p) => pathname.startsWith(p))
}

export const APP_NAV_GROUPS: AppNavGroup[] = [
  {
    id: "overview",
    labelKey: "nav.groupOverview",
    labelFallback: "Overview",
    items: [
      { nameKey: "nav.dashboard", fallback: "Dashboard", href: "/", icon: Home },
      { nameKey: "nav.reports", fallback: "Reports", href: "/reports", icon: PieChart },
      {
        nameKey: "nav.audit",
        fallback: "Audit Log",
        href: "/settings/audit",
        icon: BarChart3,
        permission: PERMISSIONS.AUDIT_READ,
      },
      {
        nameKey: "nav.compliance",
        fallback: "Sterilization log",
        href: "/reports/compliance",
        icon: Shield,
        permission: PERMISSIONS.COMPLIANCE_READ,
      },
    ],
  },
  {
    id: "clinical",
    labelKey: "nav.groupClinical",
    labelFallback: "Clinical",
    items: [
      {
        nameKey: "nav.patients",
        fallback: "Patients",
        href: "/patients",
        icon: Users,
        permission: PERMISSIONS.PATIENTS_READ,
      },
      {
        nameKey: "nav.newPatient",
        fallback: "New patient",
        href: "/patients/new",
        icon: UserPlus,
        permission: PERMISSIONS.PATIENTS_WRITE,
      },
      {
        nameKey: "nav.appointments",
        fallback: "Appointments",
        href: "/appointments",
        icon: Calendar,
        permission: PERMISSIONS.APPOINTMENTS_READ,
      },
    ],
  },
  {
    id: "frontDesk",
    labelKey: "nav.groupFrontDesk",
    labelFallback: "Front desk",
    items: [
      {
        nameKey: "nav.waitlist",
        fallback: "Waitlist",
        href: "/waitlist",
        icon: Clock,
        permission: PERMISSIONS.APPOINTMENTS_READ,
      },
      {
        nameKey: "nav.queue",
        fallback: "Queue",
        href: "/queue",
        icon: ListOrdered,
        permission: PERMISSIONS.QUEUE_MANAGE,
      },
    ],
  },
  {
    id: "billing",
    labelKey: "nav.groupBilling",
    labelFallback: "Billing & claims",
    items: [
      {
        nameKey: "nav.invoices",
        fallback: "Invoices",
        href: "/billing",
        icon: CreditCard,
        permission: PERMISSIONS.BILLING_READ,
        isActive: billingInvoicesActive,
      },
      {
        nameKey: "nav.hmoClaims",
        fallback: "HMO Claims",
        href: "/billing/hmo",
        icon: FileCheck2,
        permission: PERMISSIONS.HMO_READ,
      },
      {
        nameKey: "nav.philhealth",
        fallback: "PhilHealth",
        href: "/billing/philhealth",
        icon: Shield,
        permission: PERMISSIONS.BILLING_READ,
      },
    ],
  },
  {
    id: "operations",
    labelKey: "nav.groupOperations",
    labelFallback: "Operations",
    items: [
      {
        nameKey: "nav.inventory",
        fallback: "Inventory",
        href: "/inventory",
        icon: Package,
        permission: PERMISSIONS.SETTINGS_MANAGE,
      },
      {
        nameKey: "nav.notifications",
        fallback: "Notifications",
        href: "/settings/notifications",
        icon: Bell,
        permission: PERMISSIONS.NOTIFICATIONS_READ,
      },
    ],
  },
  {
    id: "administration",
    labelKey: "nav.groupAdministration",
    labelFallback: "Administration",
    items: [
      {
        nameKey: "nav.staff",
        fallback: "Staff & Team",
        href: "/settings/staff",
        icon: UserPlus,
        permission: PERMISSIONS.STAFF_MANAGE,
      },
      {
        nameKey: "nav.settings",
        fallback: "Settings",
        href: "/settings/organization",
        icon: Settings,
        permission: PERMISSIONS.SETTINGS_MANAGE,
        isActive: settingsHubActive,
      },
    ],
  },
  {
    id: "patientFacing",
    labelKey: "nav.groupPatientFacing",
    labelFallback: "Patient-facing",
    items: [
      {
        nameKey: "nav.tvDisplay",
        fallback: "TV Queue Display",
        href: "/display",
        icon: Monitor,
        openInNewTab: true,
        publicDevice: "display",
        permission: PERMISSIONS.QUEUE_MANAGE,
      },
      {
        nameKey: "nav.kiosk",
        fallback: "Kiosk Tablet",
        href: "/kiosk",
        icon: Tablet,
        openInNewTab: true,
        publicDevice: "kiosk",
        permission: PERMISSIONS.QUEUE_MANAGE,
      },
    ],
  },
]

export const BILLING_SUB_NAV = [
  {
    key: "billing.navInvoices",
    fallback: "Invoices",
    href: "/billing",
    permission: PERMISSIONS.BILLING_READ,
    isActive: billingInvoicesActive,
  },
  {
    key: "billing.navHmo",
    fallback: "HMO Claims",
    href: "/billing/hmo",
    permission: PERMISSIONS.HMO_READ,
  },
  {
    key: "billing.navPhilhealth",
    fallback: "PhilHealth",
    href: "/billing/philhealth",
    permission: PERMISSIONS.BILLING_READ,
  },
] as const

export const SETTINGS_NAV_GROUPS = [
  {
    labelKey: "settings.groupClinic",
    labelFallback: "Clinic",
    items: [
      { key: "settings.navOrganization", fallback: "Organization", href: "/settings/organization" },
      { key: "settings.navBranches", fallback: "Branches", href: "/settings/branches" },
      { key: "settings.navProcedures", fallback: "Procedures", href: "/settings/procedures" },
    ],
  },
  {
    labelKey: "settings.groupAccess",
    labelFallback: "Access",
    items: [
      { key: "settings.navStaff", fallback: "Staff & Team", href: "/settings/staff" },
      { key: "settings.navRoles", fallback: "Roles & Permissions", href: "/settings/roles" },
    ],
  },
  {
    labelKey: "settings.groupCompliance",
    labelFallback: "Compliance & comms",
    items: [
      { key: "settings.navNotifications", fallback: "Notifications", href: "/settings/notifications" },
      { key: "settings.navConsentTemplates", fallback: "Consent Templates", href: "/settings/consent-templates" },
      { key: "settings.navAudit", fallback: "Audit Log", href: "/settings/audit" },
      { key: "settings.navWorkflow", fallback: "Workflow automation", href: "/settings/workflow" },
    ],
  },
] as const

/** Default active check when item has no custom matcher */
export function defaultNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}
