"use client"

import Link from "next/link"
import {
  Bell,
  CalendarClock,
  FileWarning,
  Phone,
  RefreshCw,
  Stethoscope,
  Wallet,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useLocale } from "@/hooks/use-locale"
import type { DashboardStats } from "@/lib/dashboard/dashboard-service"
import type { ReportsSummary } from "@/lib/reports/reports-service"
import { cn } from "@/lib/utils"

type AutomationInboxProps = {
  stats: DashboardStats
  reportsSummary: ReportsSummary | null
  loading?: boolean
  className?: string
}

type InboxItem = {
  id: string
  title: string
  detail: string
  count: number
  href: string
  icon: typeof Bell
  tone: "default" | "warning" | "muted"
}

export function AutomationInbox({
  stats,
  reportsSummary,
  loading,
  className,
}: AutomationInboxProps) {
  const { t } = useLocale()

  const noShows = reportsSummary?.totals.noShow ?? 0

  const items: InboxItem[] = [
    {
      id: "checkin",
      title: t("inbox.awaitingCheckin", "Patients to check in"),
      detail: t("inbox.awaitingCheckinDetail", "Scheduled today but not on the board"),
      count: stats.appointments_awaiting_checkin,
      href: "/queue?focus=checkin",
      icon: CalendarClock,
      tone: stats.appointments_awaiting_checkin > 0 ? "warning" : "muted",
    },
    {
      id: "overdue",
      title: t("inbox.overdueBalances", "Overdue invoices"),
      detail: t("inbox.overdueBalancesDetail", "Follow up on payment this week"),
      count: stats.overdue_invoices,
      href: "/billing?focus=overdue",
      icon: Wallet,
      tone: stats.overdue_invoices > 0 ? "warning" : "muted",
    },
    {
      id: "noshow",
      title: t("inbox.noShows", "No-shows to rebook"),
      detail: t("inbox.noShowsDetail", "Last 7 days — call or SMS to reschedule"),
      count: noShows,
      href: "/appointments?status=no_show",
      icon: Phone,
      tone: noShows > 0 ? "warning" : "muted",
    },
    {
      id: "consents",
      title: t("inbox.pendingConsents", "Pending consents"),
      detail: t("inbox.pendingConsentsDetail", "Intake forms awaiting signature"),
      count: stats.pending_consents,
      href: "/patients?focus=consents",
      icon: FileWarning,
      tone: stats.pending_consents > 0 ? "warning" : "muted",
    },
    {
      id: "encounters",
      title: t("inbox.staleEncounters", "Open visits (stale)"),
      detail: t("inbox.staleEncountersDetail", "Encounters open too long — close or review"),
      count: stats.open_encounters_stale,
      href: "/clinical",
      icon: Stethoscope,
      tone: stats.open_encounters_stale > 0 ? "warning" : "muted",
    },
    {
      id: "recall",
      title: t("inbox.hygieneRecall", "Hygiene recall"),
      detail: t("inbox.hygieneRecallDetail", "6-month check-up SMS — review queue in reports"),
      count: 0,
      href: "/reports?focus=patients#recall",
      icon: RefreshCw,
      tone: "default",
    },
  ]

  const actionable = items.filter((item) => item.count > 0 || item.id === "recall")

  return (
    <section
      className={cn("rounded-xl border border-neutral-200 bg-white p-4 shadow-sm", className)}
      aria-label={t("inbox.title", "This week's follow-ups")}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <Bell className="h-4 w-4 text-primary-600" aria-hidden />
            {t("inbox.title", "This week's follow-ups")}
          </h2>
          <p className="text-xs text-neutral-500">
            {t("inbox.subtitle", "Automation inbox — recall, overdue, no-show, and intake gaps")}
          </p>
        </div>
        {!loading && actionable.length === 0 ? (
          <Badge variant="success">{t("inbox.allClear", "All clear")}</Badge>
        ) : null}
      </div>

      <ul className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon
          const dimmed = !loading && item.count === 0 && item.id !== "recall"
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-neutral-50",
                  dimmed ? "border-neutral-100 opacity-60" : "border-neutral-200",
                  item.tone === "warning" && item.count > 0 && "border-amber-200 bg-amber-50/40"
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-neutral-900">{item.title}</span>
                  <span className="block text-xs text-neutral-500">{item.detail}</span>
                </span>
                {item.id === "recall" ? (
                  <Badge variant="outline" className="shrink-0">
                    {t("inbox.cron", "Auto")}
                  </Badge>
                ) : (
                  <Badge
                    variant={item.count > 0 ? "warning" : "outline"}
                    className="shrink-0 tabular-nums"
                  >
                    {loading ? "—" : item.count}
                  </Badge>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
