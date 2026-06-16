import type { LucideIcon } from "lucide-react"
import {
  Calendar,
  Clock,
  FileWarning,
  Receipt,
  Users,
  ClipboardList,
  Wallet,
} from "lucide-react"
import type { DashboardStats } from "@/lib/dashboard/dashboard-service"
import { PERMISSIONS } from "@/lib/auth/permissions"

export type CockpitMode = "front_desk" | "clinical" | "owner" | "billing"

export type CockpitItem = {
  id: string
  label: string
  hint: string
  value: string | number
  href: string
  icon: LucideIcon
  variant?: "default" | "warning" | "success"
}

export type CockpitLabels = {
  titleFrontDesk: string
  titleClinical: string
  titleBilling: string
  todayAppointments: string
  todayAppointmentsHint: string
  awaitingCheckin: string
  awaitingCheckinHint: string
  pendingIntakeDrafts: string
  pendingIntakeDraftsHint: string
  queueWaiting: string
  queueWaitingHint: string
  missingNotes: string
  missingNotesHint: string
  pendingConsents: string
  pendingConsentsHint: string
  openInvoices: string
  openInvoicesHint: string
  overdueInvoices: string
  overdueInvoicesHint: string
  collectedToday: string
  collectedTodayHint: string
}

export function resolveCockpitMode(
  roleName: string | null,
  permissions?: ReadonlySet<string>
): CockpitMode {
  const role = roleName?.toLowerCase().trim() ?? ""

  if (role === "owner" || role === "admin") return "owner"
  if (role === "dentist") return "clinical"
  if (role === "receptionist" || role === "assistant") return "front_desk"

  if (permissions?.has(PERMISSIONS.BILLING_READ) && !permissions?.has(PERMISSIONS.QUEUE_MANAGE)) {
    return "billing"
  }

  return "front_desk"
}

export function cockpitTitle(mode: CockpitMode, labels: CockpitLabels): string | null {
  if (mode === "owner") return null
  if (mode === "clinical") return labels.titleClinical
  if (mode === "billing") return labels.titleBilling
  return labels.titleFrontDesk
}

export function buildCockpitItems(
  mode: CockpitMode,
  stats: DashboardStats,
  labels: CockpitLabels
): CockpitItem[] {
  if (mode === "owner") return []

  if (mode === "clinical") {
    return [
      {
        id: "queue",
        label: labels.queueWaiting,
        hint: labels.queueWaitingHint,
        value: stats.queue_waiting,
        href: "/queue",
        icon: Clock,
        variant: stats.queue_waiting > 0 ? "warning" : "default",
      },
      {
        id: "missing-notes",
        label: labels.missingNotes,
        hint: labels.missingNotesHint,
        value: stats.missing_clinical_notes,
        href: "/appointments?focus=missing-notes",
        icon: FileWarning,
        variant: stats.missing_clinical_notes > 0 ? "warning" : "default",
      },
      {
        id: "consents",
        label: labels.pendingConsents,
        hint: labels.pendingConsentsHint,
        value: stats.pending_consents,
        href: "/patients?attention=consents",
        icon: Users,
        variant: stats.pending_consents > 0 ? "warning" : "default",
      },
      {
        id: "appointments",
        label: labels.todayAppointments,
        hint: labels.todayAppointmentsHint,
        value: stats.today_appointments,
        href: "/appointments",
        icon: Calendar,
      },
    ]
  }

  if (mode === "billing") {
    return [
      {
        id: "open-invoices",
        label: labels.openInvoices,
        hint: labels.openInvoicesHint,
        value: stats.open_invoices,
        href: "/billing?focus=open",
        icon: Receipt,
        variant: stats.open_invoices > 0 ? "warning" : "default",
      },
      {
        id: "overdue",
        label: labels.overdueInvoices,
        hint: labels.overdueInvoicesHint,
        value: stats.overdue_invoices,
        href: "/billing?focus=overdue",
        icon: FileWarning,
        variant: stats.overdue_invoices > 0 ? "warning" : "default",
      },
      {
        id: "collected",
        label: labels.collectedToday,
        hint: labels.collectedTodayHint,
        value: `₱${stats.today_collected.toLocaleString()}`,
        href: "/reports/closeout",
        icon: Wallet,
        variant: stats.today_collected > 0 ? "success" : "default",
      },
    ]
  }

  // front_desk
  return [
    {
      id: "appointments",
      label: labels.todayAppointments,
      hint: labels.todayAppointmentsHint,
      value: stats.today_appointments,
      href: "/appointments",
      icon: Calendar,
    },
    {
      id: "checkin",
      label: labels.awaitingCheckin,
      hint: labels.awaitingCheckinHint,
      value: stats.appointments_awaiting_checkin,
      href: "/appointments",
      icon: Users,
      variant: stats.appointments_awaiting_checkin > 0 ? "warning" : "default",
    },
    {
      id: "intake-drafts",
      label: labels.pendingIntakeDrafts,
      hint: labels.pendingIntakeDraftsHint,
      value: stats.pending_intake_drafts,
      href: "/patients?attention=intake",
      icon: ClipboardList,
      variant: stats.pending_intake_drafts > 0 ? "warning" : "default",
    },
    {
      id: "queue",
      label: labels.queueWaiting,
      hint: labels.queueWaitingHint,
      value: stats.queue_waiting,
      href: "/queue",
      icon: Clock,
      variant: stats.queue_waiting > 0 ? "warning" : "default",
    },
  ]
}
