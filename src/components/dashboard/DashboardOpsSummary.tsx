"use client"

import { OpsSummaryGrid } from "@/components/layout/OpsSummaryGrid"
import { useLocale } from "@/hooks/use-locale"
import type { DashboardStats } from "@/lib/dashboard/dashboard-service"
import { cn } from "@/lib/utils"

type DashboardOpsSummaryProps = {
  stats: DashboardStats
  loading?: boolean
  className?: string
}

function emphasisForCount(count: number, warnAbove = 0): "default" | "warning" | "success" {
  if (count > warnAbove) return "warning"
  return "default"
}

export function DashboardOpsSummary({ stats, loading, className }: DashboardOpsSummaryProps) {
  const { t } = useLocale()

  const val = (n: number) => (loading ? "—" : n)
  const money = (n: number) => (loading ? "—" : `₱${n.toLocaleString()}`)

  const operations = [
    {
      label: t("dashboard.todayAppointments", "Appointments"),
      value: val(stats.today_appointments),
      sub: t("dashboard.todayAppointmentsHint", "Scheduled today"),
      href: "/appointments?view=today",
    },
    {
      label: t("dashboard.awaitingCheckin", "To check in"),
      value: val(stats.appointments_awaiting_checkin),
      sub: t("dashboard.awaitingCheckinHint", "Not yet on queue board"),
      emphasis: emphasisForCount(stats.appointments_awaiting_checkin, 0),
      href: "/queue?focus=checkin",
    },
    {
      label: t("dashboard.queueWaiting", "In queue"),
      value: val(stats.queue_waiting),
      sub: t("dashboard.queueWaitingHint", "Waiting through in-chair"),
      emphasis: emphasisForCount(stats.queue_waiting, 0),
      href: "/queue?filter=queue_waiting",
    },
    {
      label: t("dashboard.waitlistWaiting", "Waitlist"),
      value: val(stats.waitlist_waiting),
      sub: t("dashboard.waitlistWaitingHint", "Awaiting contact or slot"),
      emphasis: emphasisForCount(stats.waitlist_waiting, 0),
      href: "/waitlist",
    },
    {
      label: t("dashboard.activePatients", "Active patients"),
      value: val(stats.active_patients),
      sub: t("dashboard.activePatientsHint", "Registry total"),
      href: "/patients",
    },
  ]

  const finance = [
    {
      label: t("dashboard.collectedToday", "Collected"),
      value: money(stats.today_collected),
      sub: t("dashboard.collectedTodayHint", "Payments today"),
      emphasis: !loading && stats.today_collected > 0 ? ("success" as const) : ("default" as const),
      href: "/reports/closeout",
    },
    {
      label: t("dashboard.openInvoices", "Open invoices"),
      value: val(stats.open_invoices),
      sub: t("dashboard.openInvoicesHint", "Outstanding balance"),
      emphasis: emphasisForCount(stats.open_invoices, 0),
      href: "/billing?focus=open",
    },
    {
      label: t("dashboard.overdueInvoices", "Overdue"),
      value: val(stats.overdue_invoices),
      sub: t("dashboard.overdueInvoicesHint", "Past due"),
      emphasis: emphasisForCount(stats.overdue_invoices, 0),
      href: "/billing?focus=overdue",
    },
    {
      label: t("dashboard.hmoDraft", "HMO drafts"),
      value: val(stats.hmo_draft_claims),
      sub: t("dashboard.hmoDraftHint", "Not yet submitted"),
      emphasis: emphasisForCount(stats.hmo_draft_claims, 0),
      href: "/billing/hmo?status=draft",
    },
    {
      label: t("dashboard.philhealthPending", "PhilHealth"),
      value: val(stats.philhealth_pending),
      sub: t("dashboard.philhealthPendingHint", "Pending claims"),
      emphasis: emphasisForCount(stats.philhealth_pending, 0),
      href: "/billing/philhealth?status=pending",
    },
  ]

  const records = [
    {
      label: t("dashboard.pendingConsents", "Consents"),
      value: val(stats.pending_consents),
      sub: t("dashboard.pendingConsentsHint", "Awaiting signature"),
      emphasis: emphasisForCount(stats.pending_consents, 0),
      href: "/patients?attention=consents",
    },
    {
      label: t("dashboard.pendingIntakeDrafts", "Intake drafts"),
      value: val(stats.pending_intake_drafts),
      sub: t("dashboard.pendingIntakeDraftsHint", "Kiosk & portal"),
      emphasis: emphasisForCount(stats.pending_intake_drafts, 0),
      href: "/patients?attention=intake",
    },
    {
      label: t("dashboard.missingNotes", "Missing notes"),
      value: val(stats.missing_clinical_notes),
      sub: t("dashboard.missingNotesHint", "Last 7 days"),
      emphasis: emphasisForCount(stats.missing_clinical_notes, 0),
      href: "/appointments?focus=missing-notes",
    },
    {
      label: t("dashboard.openEncountersStale", "Stale visits"),
      value: val(stats.open_encounters_stale),
      sub: t("dashboard.openEncountersStaleHint", "Open from prior days"),
      emphasis: emphasisForCount(stats.open_encounters_stale, 0),
      href: "/reports?focus=clinical#clinical",
    },
    {
      label: t("dashboard.lowStockItems", "Low stock"),
      value: val(stats.low_stock_items),
      sub: t("dashboard.lowStockHint", "Below reorder level"),
      emphasis: emphasisForCount(stats.low_stock_items, 0),
      href: "/inventory?alerts=1",
    },
  ]

  return (
    <div className={cn("space-y-4", className)}>
      <OpsSummaryGrid
        title={t("dashboard.opsOperationsTitle", "Operations today")}
        subtitle={t("dashboard.opsSummarySubtitle", "Live branch totals — open modules for actions")}
        items={operations}
        columnsClassName="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      />
      <OpsSummaryGrid
        title={t("dashboard.opsFinanceTitle", "Finance & claims")}
        items={finance}
        columnsClassName="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      />
      <OpsSummaryGrid
        title={t("dashboard.opsRecordsTitle", "Records & stock")}
        items={records}
        columnsClassName="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      />
    </div>
  )
}
