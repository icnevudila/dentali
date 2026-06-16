"use client"

import * as React from "react"
import { Sparkles } from "lucide-react"
import { useLocale } from "@/hooks/use-locale"
import { useStaffRole } from "@/hooks/use-staff-role"
import { useAttentionContext } from "@/hooks/use-attention-context"
import type { DashboardStats } from "@/lib/dashboard/dashboard-service"
import {
  buildCockpitItems,
  cockpitTitle,
  resolveCockpitMode,
} from "@/lib/dashboard/role-cockpit"
import { MetricStrip } from "@/components/layout/MetricStrip"
import { cn } from "@/lib/utils"

type RoleDashboardCockpitProps = {
  stats: DashboardStats
  loading?: boolean
  className?: string
}

export function RoleDashboardCockpit({ stats, loading, className }: RoleDashboardCockpitProps) {
  const { t } = useLocale()
  const { roleName, loading: roleLoading } = useStaffRole()
  const { permissions } = useAttentionContext()

  const labels = React.useMemo(
    () => ({
      titleFrontDesk: t("dashboard.cockpitFrontDesk", "Front desk cockpit"),
      titleClinical: t("dashboard.cockpitClinical", "Clinical cockpit"),
      titleBilling: t("dashboard.cockpitBilling", "Billing cockpit"),
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

  if (mode === "owner" || !title) return null
  if (roleLoading || loading) return null

  const items = buildCockpitItems(mode, stats, labels).map((item) => ({
    label: item.label,
    value: item.value,
    hint: item.hint,
    icon: item.icon,
    href: item.href,
    variant: item.variant,
  }))

  return (
    <section
      className={cn(
        "animate-fade-rise rounded-2xl border border-primary-200/70 bg-gradient-to-br from-primary-50/50 via-white to-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)]",
        className
      )}
      aria-label={title}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
          <Sparkles className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
          <p className="text-xs text-neutral-500">
            {t("dashboard.cockpitSubtitle", "Your priority actions for this shift")}
          </p>
        </div>
      </div>
      <MetricStrip items={items} className="lg:grid-cols-4" />
    </section>
  )
}
