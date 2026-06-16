"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/layout/PageHeader"
import { SectionEyebrow } from "@/components/layout/SectionEyebrow"
import { MetricStrip } from "@/components/layout/MetricStrip"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { useDashboardStats } from "@/hooks/use-dashboard-stats"
import { useAttentionContext } from "@/hooks/use-attention-context"
import { DirectionalTransition } from "@/components/layout/DirectionalTransition"
import { NAV_FORWARD_TRANSITION } from "@/lib/navigation/view-transition"
import { DashboardVisualPanel } from "@/components/dashboard/DashboardVisualPanel"
import { AttentionPanel } from "@/components/dashboard/AttentionPanel"
import { DailyCloseoutCard } from "@/components/dashboard/DailyCloseoutCard"
import { RoleDashboardCockpit } from "@/components/dashboard/RoleDashboardCockpit"
import { MonthlyAppointmentsSnapshot } from "@/components/analytics/MonthlyAppointmentsSnapshot"
import { ReportsSectionBlock } from "@/components/reports/ReportsSectionBlock"
import { ReportDrillLink } from "@/components/reports/ReportDrillLink"
import { WorkflowSettingsLink } from "@/components/layout/WorkflowSettingsLink"
import { useReportsSummary } from "@/hooks/use-reports-summary"
import {
  Users,
  Calendar,
  FileWarning,
  Plus,
  Clock,
  Receipt,
  Wallet,
  PackageX,
  Radio,
  MapPin,
  LayoutDashboard,
  BarChart3,
  UserCheck,
} from "lucide-react"

const DASHBOARD_PERIOD_OPTIONS = [7, 30, 90] as const
type DashboardPeriodDays = (typeof DASHBOARD_PERIOD_OPTIONS)[number]

export default function DashboardPage() {
  const { activeBranch } = useBranch()
  const { t, locale } = useLocale()
  const [chartPeriodDays, setChartPeriodDays] = React.useState<DashboardPeriodDays>(7)
  const { stats, loading, error, live, lastUpdated, reload } = useDashboardStats()
  const { permissions, workflowSettings } = useAttentionContext()
  const {
    summary: reportsSummary,
    loading: reportsLoading,
  } = useReportsSummary(chartPeriodDays, locale)

  const chartPeriodLabel = String(chartPeriodDays)

  const dashboardDescription = React.useMemo(() => {
    if (!activeBranch) {
      return t("dashboard.selectBranch", "Select a branch to view stats")
    }
    if (loading) {
      return t("dashboard.subtitleLoading", "Loading today's numbers for this branch…")
    }
    const collected =
      stats.today_collected > 0
        ? `₱${stats.today_collected.toLocaleString()}`
        : t("dashboard.noCollectionsYet", "no collections yet")
    return t(
      "dashboard.subtitleWithStats",
      "{branch} — {appts} appointments today, {queue} in queue, {collected} collected."
    )
      .replace("{branch}", activeBranch.name)
      .replace("{appts}", String(stats.today_appointments))
      .replace("{queue}", String(stats.queue_waiting))
      .replace("{collected}", collected)
  }, [activeBranch, loading, stats, t])

  const flowMetrics = [
    {
      label: t("dashboard.todayAppointments", "Today's Appointments"),
      value: loading ? "—" : stats.today_appointments,
      hint: t("dashboard.todayAppointmentsHint", "Scheduled or confirmed today"),
      icon: Calendar,
      href: "/appointments",
    },
    {
      label: t("dashboard.queueWaiting", "Queue Waiting"),
      value: loading ? "—" : stats.queue_waiting,
      hint: t("dashboard.viewQueue", "View queue board"),
      icon: Clock,
      href: "/queue",
      variant: stats.queue_waiting > 0 && !loading ? ("warning" as const) : ("default" as const),
    },
    {
      label: t("dashboard.awaitingCheckin", "Awaiting check-in"),
      value: loading ? "—" : stats.appointments_awaiting_checkin,
      hint: t("dashboard.awaitingCheckinHint", "Check in on Queue → Today's arrivals"),
      icon: UserCheck,
      href: "/queue",
      variant:
        stats.appointments_awaiting_checkin > 0 && !loading ? ("warning" as const) : ("default" as const),
    },
    {
      label: t("dashboard.pendingConsents", "Pending Consents"),
      value: loading ? "—" : stats.pending_consents,
      hint: t("dashboard.pendingConsentsHint", "Awaiting patient signature"),
      icon: FileWarning,
      href: "/patients",
      variant: stats.pending_consents > 0 && !loading ? ("warning" as const) : ("default" as const),
    },
  ]

  const revenueMetrics = [
    {
      label: t("dashboard.openInvoices", "Open Invoices"),
      value: loading ? "—" : stats.open_invoices,
      hint: t("dashboard.viewBilling", "View billing"),
      icon: Receipt,
      href: "/billing",
      variant: stats.open_invoices > 0 && !loading ? ("warning" as const) : ("default" as const),
    },
    {
      label: t("dashboard.collectedToday", "Collected Today"),
      value: loading ? "—" : `₱${stats.today_collected.toLocaleString()}`,
      hint: t("dashboard.collectedTodayHint", "Payments recorded today"),
      icon: Wallet,
      variant: stats.today_collected > 0 && !loading ? ("success" as const) : ("default" as const),
    },
    {
      label: t("dashboard.lowStockItems", "Low Stock Items"),
      value: loading ? "—" : stats.low_stock_items,
      hint: t("dashboard.viewInventory", "View inventory"),
      icon: PackageX,
      href: "/inventory",
      variant: stats.low_stock_items > 0 && !loading ? ("warning" as const) : ("default" as const),
    },
  ]

  const registryMetrics = [
    {
      label: t("dashboard.activePatients", "Active Patients"),
      value: loading ? "—" : stats.active_patients,
      hint: t("dashboard.activePatientsHint", "Organization-wide registry"),
      icon: Users,
      href: "/patients",
    },
  ]

  return (
    <DirectionalTransition className="mx-auto w-full max-w-7xl">
      <ContentPanel padding="lg" className="space-y-8">
        <SectionEyebrow icon={LayoutDashboard}>
          {t("dashboard.eyebrow", "Overview")} · {t("dashboard.title", "Dashboard")}
        </SectionEyebrow>

        <PageHeader
          title={t("dashboard.title", "Dashboard")}
          description={dashboardDescription}
          actions={
            <Button asChild className="gap-2 shadow-sm">
              <Link href="/patients/new" transitionTypes={NAV_FORWARD_TRANSITION}>
                <Plus className="h-4 w-4" />
                {t("dashboard.newPatient", "New Patient")}
              </Link>
            </Button>
          }
        />

        {activeBranch ? (
          <RoleDashboardCockpit stats={stats} loading={loading} />
        ) : null}

        {activeBranch ? (
          <div className="flex flex-wrap items-center gap-2 animate-fade-rise">
            <Badge variant="info" className="gap-1 font-normal">
              <MapPin className="h-3 w-3" aria-hidden />
              {activeBranch.name}
            </Badge>
            {live ? (
              <Badge variant="success" className="gap-1 font-normal">
                <Radio className="h-3 w-3" aria-hidden />
                {t("dashboard.live", "Live")}
              </Badge>
            ) : null}
            {lastUpdated ? (
              <Badge variant="outline" className="font-normal tabular-nums">
                {t("dashboard.updatedAt", "Updated")}{" "}
                {lastUpdated.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
              </Badge>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-neutral-500 animate-fade-rise">
            {t("dashboard.selectBranch", "Select a branch to view stats")}
          </p>
        )}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 animate-fade-rise">
            <p className="text-sm text-red-700">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void reload()}>
              {t("common.retry", "Retry")}
            </Button>
          </div>
        ) : null}

        {activeBranch ? (
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
            <div className="min-w-0 flex-1 space-y-4">
              <SectionEyebrow icon={BarChart3}>
                {t("dashboard.sectionInsights", "Branch trends")}
              </SectionEyebrow>
              <DashboardVisualPanel
                summary={reportsSummary}
                loading={reportsLoading}
                periodDays={chartPeriodDays}
                onPeriodChange={setChartPeriodDays}
                labels={{
                  weekAppointments: t(
                    "dashboard.chartAppointments",
                    "Appointments — last {days} days"
                  ).replace("{days}", chartPeriodLabel),
                  weekCollections: t(
                    "dashboard.chartCollections",
                    "Collections — last {days} days"
                  ).replace("{days}", chartPeriodLabel),
                  statusMix: t("dashboard.chartStatusMix", "Status mix ({days}d)").replace(
                    "{days}",
                    chartPeriodLabel
                  ),
                  viewReports: t("dashboard.viewReportsHub", "Open Reports Hub"),
                  loading: t("common.loading", "Loading…"),
                  periodHint: t("dashboard.chartPeriodHint", "Trends at this branch"),
                  periodLabel: t("dashboard.chartPeriodLabel", "Chart period"),
                  emptyChart: t("dashboard.chartEmpty", "No activity in this period"),
                  emptyStatus: t(
                    "dashboard.chartEmptyStatus",
                    "No appointments in the last {days} days"
                  ).replace("{days}", chartPeriodLabel),
                }}
              />
              <MonthlyAppointmentsSnapshot branchId={activeBranch.id} />
            </div>
            <div className="w-full shrink-0 space-y-4 xl:w-80">
            <AttentionPanel
              stats={stats}
              permissions={permissions}
              workflowSettings={workflowSettings}
              labels={{
                title: t("dashboard.attentionTitle", "Needs attention"),
                allClear: t("dashboard.attentionClear", "All clear — nothing urgent right now."),
                pendingConsents: t("dashboard.pendingConsents", "Pending Consents"),
                pendingIntakeDrafts: t("dashboard.pendingIntakeDrafts", "Pending intake drafts"),
                appointmentsAwaitingCheckin: t(
                  "dashboard.awaitingCheckin",
                  "Awaiting check-in"
                ),
                queueWaiting: t("dashboard.queueWaiting", "Queue Waiting"),
                waitlistWaiting: t("dashboard.waitlistWaiting", "Waitlist pending"),
                openInvoices: t("dashboard.openInvoices", "Open Invoices"),
                lowStock: t("dashboard.lowStockItems", "Low Stock Items"),
                missingNotes: t("dashboard.missingNotes", "Missing clinical notes"),
                overdueInvoices: t("dashboard.overdueInvoices", "Overdue invoices"),
                hmoDraft: t("dashboard.hmoDraft", "HMO draft claims"),
                philhealthPending: t("dashboard.philhealthPending", "PhilHealth pending"),
                openEncountersStale: t(
                  "dashboard.openEncountersStale",
                  "Open visits from prior days"
                ),
                manualActionHint: t(
                  "dashboard.attentionManualHint",
                  "Automation off — staff action required"
                ),
              }}
            />
            <DailyCloseoutCard stats={stats} />
            </div>
          </div>
        ) : null}

        {activeBranch ? (
          <ReportsSectionBlock
            icon={BarChart3}
            eyebrow={t("dashboard.previewEyebrow", "Operational preview")}
            title={t("dashboard.previewTitle", "Branch flow at a glance")}
            description={t(
              "dashboard.previewDescription",
              "Operational KPIs stay on this page. Full queue, registry, and display analytics live in Reports."
            )}
            action={
              <div className="flex flex-wrap gap-2">
                <WorkflowSettingsLink />
                <Button variant="outline" size="sm" asChild>
                  <Link href="/reports">{t("dashboard.viewReportsHub", "Open Reports Hub")}</Link>
                </Button>
              </div>
            }
          >
            <div className="grid gap-4 xl:grid-cols-3">
              <ReportDrillLink
                title={t("dashboard.previewQueueTitle", "Queue pressure")}
                description={t(
                  "dashboard.previewQueueDescription",
                  "Arrival speed, wait duration, and status movement for front-desk rebalancing."
                )}
                href="/reports#operations"
                linkLabel={t("dashboard.previewQueueLink", "Queue reports")}
              />
              <ReportDrillLink
                title={t("dashboard.previewPatientsTitle", "Record readiness")}
                description={t(
                  "dashboard.previewPatientsDescription",
                  "Intake completion, registry quality, and patient growth trends."
                )}
                href="/reports#clinical"
                linkLabel={t("dashboard.previewPatientsLink", "Registry reports")}
              />
              <ReportDrillLink
                title={t("dashboard.previewDisplayTitle", "Display and public flow")}
                description={t(
                  "dashboard.previewDisplayDescription",
                  "Kiosk traffic, TV display health, and public link management."
                )}
                href="/reports#devices"
                linkLabel={t("dashboard.previewDisplayLink", "Device reports")}
              />
            </div>
          </ReportsSectionBlock>
        ) : null}

        <section className="space-y-3">
          <SectionEyebrow icon={Calendar}>
            {t("dashboard.sectionFlow", "Front desk today")}
          </SectionEyebrow>
          <MetricStrip items={flowMetrics} className="lg:grid-cols-3" />
        </section>

        <section className="space-y-3">
          <SectionEyebrow icon={Receipt}>
            {t("dashboard.sectionRevenue", "Revenue & stock")}
          </SectionEyebrow>
          <MetricStrip items={revenueMetrics} className="lg:grid-cols-3" />
        </section>

        <section className="space-y-3">
          <SectionEyebrow icon={Users}>
            {t("dashboard.sectionRegistry", "Registry")}
          </SectionEyebrow>
          <MetricStrip items={registryMetrics} className="sm:grid-cols-2 lg:grid-cols-3" />
        </section>

        {activeBranch ? (
          <ReportDrillLink
            title={t("dashboard.benchmarkLinkTitle", "Multi-branch benchmark")}
            description={t(
              "dashboard.benchmarkLinkDescription",
              "Compare appointments and collections across branches for the selected period."
            )}
            href="/reports#benchmark"
            linkLabel={t("dashboard.benchmarkLinkCta", "Open branch benchmark")}
          />
        ) : null}
      </ContentPanel>
    </DirectionalTransition>
  )
}
