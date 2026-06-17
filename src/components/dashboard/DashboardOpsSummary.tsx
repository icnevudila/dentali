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

export function DashboardOpsSummary({ stats, loading, className }: DashboardOpsSummaryProps) {
  const { t } = useLocale()

  const items = [
    {
      label: t("dashboard.todayAppointments", "Appointments"),
      value: loading ? "—" : stats.today_appointments,
      sub: t("dashboard.todayAppointmentsHint", "Scheduled today"),
      href: "/appointments",
    },
    {
      label: t("dashboard.queueWaiting", "In queue"),
      value: loading ? "—" : stats.queue_waiting,
      sub: t("dashboard.viewQueue", "Live board"),
      href: "/queue?focus=waiting",
      emphasis:
        !loading && stats.queue_waiting > 0 ? ("warning" as const) : ("default" as const),
    },
    {
      label: t("dashboard.awaitingCheckin", "To check in"),
      value: loading ? "—" : stats.appointments_awaiting_checkin,
      sub: t("dashboard.awaitingCheckinHint", "On Queue arrivals"),
      href: "/queue?focus=checkin",
      emphasis:
        !loading && stats.appointments_awaiting_checkin > 0
          ? ("warning" as const)
          : ("default" as const),
    },
    {
      label: t("dashboard.collectedToday", "Collected"),
      value: loading ? "—" : `₱${stats.today_collected.toLocaleString()}`,
      sub: t("dashboard.collectedTodayHint", "Payments today"),
      href: "/reports/closeout",
      emphasis:
        !loading && stats.today_collected > 0 ? ("success" as const) : ("default" as const),
    },
    {
      label: t("dashboard.openInvoices", "Open invoices"),
      value: loading ? "—" : stats.open_invoices,
      sub: t("dashboard.viewBilling", "Billing ledger"),
      href: "/billing?focus=open",
      emphasis:
        !loading && stats.open_invoices > 0 ? ("warning" as const) : ("default" as const),
    },
    {
      label: t("dashboard.pendingConsents", "Consents"),
      value: loading ? "—" : stats.pending_consents,
      sub: t("dashboard.pendingConsentsHint", "Awaiting signature"),
      href: "/patients?attention=consents",
      emphasis:
        !loading && stats.pending_consents > 0 ? ("warning" as const) : ("default" as const),
    },
    {
      label: t("dashboard.lowStockItems", "Low stock"),
      value: loading ? "—" : stats.low_stock_items,
      sub: t("dashboard.viewInventory", "Inventory"),
      href: "/inventory?focus=low-stock",
      emphasis:
        !loading && stats.low_stock_items > 0 ? ("warning" as const) : ("default" as const),
    },
  ]

  return (
    <OpsSummaryGrid
      className={cn(className)}
      title={t("dashboard.opsSummaryTitle", "Today's clinic summary")}
      subtitle={t("dashboard.opsSummarySubtitle", "Live branch totals — details in each module")}
      items={items}
      columnsClassName="sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"
    />
  )
}
