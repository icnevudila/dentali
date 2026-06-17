"use client"

import { CalendarDays, CircleDollarSign, Clock, ListOrdered, Receipt, UserX } from "lucide-react"
import { MetricStrip } from "@/components/layout/MetricStrip"
import { useLocale } from "@/hooks/use-locale"
import type { DashboardStats } from "@/lib/dashboard/dashboard-service"
import type { ReportsSummary } from "@/lib/reports/reports-service"

type OwnerMorningDashboardProps = {
  stats: DashboardStats
  reportsSummary: ReportsSummary | null
  loading?: boolean
}

export function OwnerMorningDashboard({
  stats,
  reportsSummary,
  loading,
}: OwnerMorningDashboardProps) {
  const { t } = useLocale()

  const val = (n: number) => (loading ? "—" : String(n))
  const money = (n: number) => (loading ? "—" : `₱${n.toLocaleString()}`)
  const noShows = reportsSummary?.totals.noShow ?? 0

  const items = [
    {
      icon: CircleDollarSign,
      label: t("dashboard.morningCollected", "Collected today"),
      value: money(stats.today_collected),
      href: "/reports/closeout",
      emphasis: !loading && stats.today_collected > 0 ? ("success" as const) : undefined,
    },
    {
      icon: CalendarDays,
      label: t("dashboard.morningAppointments", "Appointments"),
      value: val(stats.today_appointments),
      href: "/appointments?view=today",
    },
    {
      icon: Clock,
      label: t("dashboard.morningAwaitingCheckin", "To check in"),
      value: val(stats.appointments_awaiting_checkin),
      href: "/queue?focus=checkin",
      emphasis: stats.appointments_awaiting_checkin > 0 ? ("warning" as const) : undefined,
    },
    {
      icon: ListOrdered,
      label: t("dashboard.morningQueue", "In queue"),
      value: val(stats.queue_waiting),
      href: "/queue?filter=queue_waiting",
      emphasis: stats.queue_waiting > 0 ? ("warning" as const) : undefined,
    },
    {
      icon: Receipt,
      label: t("dashboard.morningOverdue", "Overdue"),
      value: val(stats.overdue_invoices),
      href: "/billing?focus=overdue",
      emphasis: stats.overdue_invoices > 0 ? ("warning" as const) : undefined,
    },
    {
      icon: UserX,
      label: t("dashboard.morningNoShows", "No-shows (7d)"),
      value: loading && !reportsSummary ? "—" : String(noShows),
      href: "/appointments?status=no_show",
      emphasis: noShows > 0 ? ("warning" as const) : undefined,
    },
  ]

  return (
    <section aria-label={t("dashboard.morningTitle", "Morning snapshot")} className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-neutral-900">
          {t("dashboard.morningTitle", "Morning snapshot")}
        </h2>
        <p className="text-xs text-neutral-500">
          {t("dashboard.morningSubtitle", "Owner view — today's pulse in one row")}
        </p>
      </div>
      <MetricStrip
        desktopCols={6}
        className="grid-cols-2 md:grid-cols-3 xl:grid-cols-6"
        items={items.map((item) => ({
          label: item.label,
          value: item.value,
          href: item.href,
          variant: item.emphasis,
          icon: item.icon,
        }))}
      />
    </section>
  )
}
