"use client"

import * as React from "react"
import { useLocale } from "@/hooks/use-locale"
import { useStaffRole } from "@/hooks/use-staff-role"
import { useAttentionContext } from "@/hooks/use-attention-context"
import type { DashboardStats } from "@/lib/dashboard/dashboard-service"
import {
  buildCockpitItems,
  cockpitTitle,
  resolveCockpitMode,
  type CockpitMode,
} from "@/lib/dashboard/role-cockpit"
import { MetricStrip } from "@/components/layout/MetricStrip"
import { cn } from "@/lib/utils"

type RoleDashboardCockpitProps = {
  stats: DashboardStats
  loading?: boolean
  className?: string
}

function buildCockpitSubtitle(
  mode: CockpitMode,
  stats: DashboardStats,
  loading: boolean,
  t: (key: string, fallback: string) => string
): string {
  if (loading) {
    return t("dashboard.cockpitSubtitleLoading", "Updating your shift summary…")
  }

  if (mode === "clinical") {
    const queue = stats.queue_waiting
    const notes = stats.missing_clinical_notes
    if (queue > 0 && notes > 0) {
      return t(
        "dashboard.cockpitClinicalBusy",
        "{queue} patients in clinic · {notes} visits still need notes"
      )
        .replace("{queue}", String(queue))
        .replace("{notes}", String(notes))
    }
    if (queue > 0) {
      return t("dashboard.cockpitClinicalQueue", "{queue} patients in today's chair queue")
        .replace("{queue}", String(queue))
    }
    return t("dashboard.cockpitClinicalClear", "No patients waiting in the chair queue right now")
  }

  if (mode === "billing") {
    const open = stats.open_invoices
    const overdue = stats.overdue_invoices
    if (overdue > 0) {
      return t(
        "dashboard.cockpitBillingOverdue",
        "{open} open invoices · {overdue} overdue"
      )
        .replace("{open}", String(open))
        .replace("{overdue}", String(overdue))
    }
    return t(
      "dashboard.cockpitBillingOpen",
      "{open} open invoices · ₱{collected} collected today"
    )
      .replace("{open}", String(open))
      .replace("{collected}", stats.today_collected.toLocaleString())
  }

  const checkin = stats.appointments_awaiting_checkin
  const queue = stats.queue_waiting
  const intake = stats.pending_intake_drafts
  if (checkin > 0 || queue > 0 || intake > 0) {
    return t(
      "dashboard.cockpitFrontDeskBusy",
      "{checkin} awaiting check-in · {queue} in queue · {intake} intake drafts"
    )
      .replace("{checkin}", String(checkin))
      .replace("{queue}", String(queue))
      .replace("{intake}", String(intake))
  }
  return t("dashboard.cockpitFrontDeskClear", "Check-ins, queue, and intake are clear for now")
}

export function RoleDashboardCockpit({ stats, loading = false, className }: RoleDashboardCockpitProps) {
  const { t } = useLocale()
  const { roleName, loading: roleLoading } = useStaffRole()
  const { permissions } = useAttentionContext()

  const labels = React.useMemo(
    () => ({
      titleFrontDesk: t("dashboard.cockpitFrontDesk", "Front desk today"),
      titleClinical: t("dashboard.cockpitClinical", "Your chair queue"),
      titleBilling: t("dashboard.cockpitBilling", "Billing today"),
      todayAppointments: t("dashboard.todayAppointments", "Today's Appointments"),
      todayAppointmentsHint: t("dashboard.todayAppointmentsHint", "Scheduled or confirmed today"),
      awaitingCheckin: t("dashboard.awaitingCheckin", "Awaiting check-in"),
      awaitingCheckinHint: t("dashboard.awaitingCheckinHint", "Arrived patients not yet in queue"),
      pendingIntakeDrafts: t("dashboard.pendingIntakeDrafts", "Pending intake drafts"),
      pendingIntakeDraftsHint: t("dashboard.pendingIntakeDraftsHint", "Kiosk or portal registrations to review"),
      queueWaiting: t("dashboard.queueWaiting", "Queue Waiting"),
      queueWaitingHint: t("dashboard.viewQueue", "View queue board"),
      missingNotes: t("dashboard.missingNotes", "Missing clinical notes"),
      missingNotesHint: t("dashboard.missingNotesHint", "Visits without SOAP documentation"),
      pendingConsents: t("dashboard.pendingConsents", "Pending Consents"),
      pendingConsentsHint: t("dashboard.pendingConsentsHint", "Awaiting patient signature"),
      openInvoices: t("dashboard.openInvoices", "Open Invoices"),
      openInvoicesHint: t("dashboard.viewBilling", "View billing"),
      overdueInvoices: t("dashboard.overdueInvoices", "Overdue invoices"),
      overdueInvoicesHint: t("dashboard.overdueInvoicesHint", "Past due — follow up today"),
      collectedToday: t("dashboard.collectedToday", "Collected Today"),
      collectedTodayHint: t("dashboard.collectedTodayHint", "Payments recorded today"),
    }),
    [t]
  )

  const mode = resolveCockpitMode(roleName, permissions)
  const title = cockpitTitle(mode, labels)
  const subtitle = buildCockpitSubtitle(mode, stats, loading || roleLoading, t)

  if (mode === "owner" || !title) return null

  const items = buildCockpitItems(mode, stats, labels).map((item) => ({
    label: item.label,
    value: loading || roleLoading ? "—" : item.value,
    hint: item.hint,
    icon: item.icon,
    href: item.href,
    variant: item.variant,
  }))

  return (
    <section className={cn("animate-fade-rise space-y-3", className)} aria-label={title}>
      <div>
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
        <p className="text-sm text-neutral-600">{subtitle}</p>
      </div>
      <MetricStrip items={items} className="lg:grid-cols-4" />
    </section>
  )
}
