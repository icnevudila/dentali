"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/layout/PageHeader"
import { SectionEyebrow } from "@/components/layout/SectionEyebrow"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { useDashboardStats } from "@/hooks/use-dashboard-stats"
import { useAttentionContext } from "@/hooks/use-attention-context"
import { DirectionalTransition } from "@/components/layout/DirectionalTransition"
import { NAV_FORWARD_TRANSITION } from "@/lib/navigation/view-transition"
import { DashboardVisualPanel } from "@/components/dashboard/DashboardVisualPanel"
import { DashboardScheduleSection } from "@/components/dashboard/DashboardScheduleSection"
import { AttentionPanel } from "@/components/dashboard/AttentionPanel"
import { DailyCloseoutCard } from "@/components/dashboard/DailyCloseoutCard"
import { DashboardOpsSummary } from "@/components/dashboard/DashboardOpsSummary"
import { DashboardExtendedReports } from "@/components/dashboard/DashboardExtendedReports"
import { AutomationInbox } from "@/components/dashboard/AutomationInbox"
import { useReportsSummary } from "@/hooks/use-reports-summary"
import {
  Plus,
  Radio,
  MapPin,
  LayoutDashboard,
  BarChart3,
  UserCheck,
} from "lucide-react"
import { CollapsibleBelowFold } from "@/components/layout/CollapsibleBelowFold"
import { StickyActionBar } from "@/components/layout/StickyActionBar"

type DashboardPeriodDays = 7 | 30 | 90

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

  return (
    <DirectionalTransition className="mx-auto w-full max-w-[1600px]">
      <ContentPanel padding="lg" className="space-y-8">
        <SectionEyebrow icon={LayoutDashboard} hideOnMobile>
          {t("dashboard.eyebrow", "Overview")} · {t("dashboard.title", "Dashboard")}
        </SectionEyebrow>

        <PageHeader
          compact
          title={t("dashboard.title", "Dashboard")}
          description={dashboardDescription}
          actions={
            <Button asChild className="hidden gap-2 shadow-sm md:inline-flex">
              <Link href="/patients/new" transitionTypes={NAV_FORWARD_TRANSITION}>
                <Plus className="h-4 w-4" />
                {t("dashboard.newPatient", "New Patient")}
              </Link>
            </Button>
          }
        />

        <StickyActionBar>
          <div className="flex gap-2">
            <Button asChild className="h-11 flex-1 gap-2">
              <Link href="/patients/new" transitionTypes={NAV_FORWARD_TRANSITION}>
                <Plus className="h-4 w-4 shrink-0" />
                {t("dashboard.newPatient", "New Patient")}
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-11 flex-1 gap-2">
              <Link href="/queue">
                <UserCheck className="h-4 w-4 shrink-0" />
                {t("dashboard.openQueue", "Queue")}
              </Link>
            </Button>
          </div>
        </StickyActionBar>

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
          <DashboardScheduleSection branchId={activeBranch.id} periodDays={chartPeriodDays} />
        ) : null}

        {activeBranch ? (
          <CollapsibleBelowFold summary={t("dashboard.opsSummaryToggle", "Today's numbers")}>
            <DashboardOpsSummary stats={stats} loading={loading} />
          </CollapsibleBelowFold>
        ) : null}

        {activeBranch ? (
          <div className="grid w-full min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] xl:items-start">
            <div className="min-w-0 space-y-6">
              <SectionEyebrow icon={BarChart3}>
                {t("dashboard.sectionInsights", "Branch trends")}
              </SectionEyebrow>
              <DashboardVisualPanel
                summary={reportsSummary}
                loading={reportsLoading}
                periodDays={chartPeriodDays}
                onPeriodChange={setChartPeriodDays}
                reportsHref={`/reports?period=${chartPeriodDays}&focus=appointments#operations`}
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
              <DashboardExtendedReports
                branchId={activeBranch.id}
                periodDays={chartPeriodDays}
                reportsSummary={reportsSummary}
                summaryLoading={reportsLoading}
              />
            </div>
            <div className="min-w-0 space-y-4">
            <AutomationInbox
              stats={stats}
              reportsSummary={reportsSummary}
              loading={loading || reportsLoading}
            />
            <AttentionPanel
              stats={stats}
              permissions={permissions}
              workflowSettings={workflowSettings}
              interactive
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
            <DailyCloseoutCard stats={stats} interactive />
            </div>
          </div>
        ) : null}

      </ContentPanel>
    </DirectionalTransition>
  )
}
