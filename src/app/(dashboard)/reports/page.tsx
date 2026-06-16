"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  BarChart3,
  Calendar,
  Receipt,
  ScrollText,
  Package,
  Users,
  TrendingUp,
  Wallet,
  CheckCircle2,
  XCircle,
  Download,
  RefreshCw,
  MapPin,
  Shield,
  FileWarning,
  Clock3,
  Monitor,
  Timer,
} from "lucide-react"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { MetricStrip } from "@/components/layout/MetricStrip"
import { TrendArea, TrendLine, DistributionPie } from "@/components/charts/ChartKit"
import { useOwnerAnalytics } from "@/hooks/use-owner-analytics"
import { StatusBreakdown } from "@/components/charts/StatusBreakdown"
import { ReportQuickLinks, type ReportLink } from "@/components/reports/ReportQuickLinks"
import { ReportsSectionBlock } from "@/components/reports/ReportsSectionBlock"
import { ReportPanelCaption } from "@/components/reports/ReportPanelCaption"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { useReportsSummary } from "@/hooks/use-reports-summary"
import { useDashboardStats } from "@/hooks/use-dashboard-stats"
import { buildReportsCsv, downloadReportsCsv } from "@/lib/reports/reports-export"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { AppointmentsAnalyticsPanel } from "@/components/analytics/AppointmentsAnalyticsPanel"
import { QueueAnalyticsPanel } from "@/components/analytics/QueueAnalyticsPanel"
import { WaitlistAnalyticsPanel } from "@/components/analytics/WaitlistAnalyticsPanel"
import { PatientsAnalyticsPanel } from "@/components/analytics/PatientsAnalyticsPanel"
import { InventoryAnalyticsPanel } from "@/components/analytics/InventoryAnalyticsPanel"
import { NotificationAnalyticsPanel } from "@/components/analytics/NotificationAnalyticsPanel"
import { AuditAnalyticsPanel } from "@/components/analytics/AuditAnalyticsPanel"
import { HmoAnalyticsPanel } from "@/components/analytics/HmoAnalyticsPanel"
import { PhilHealthAnalyticsPanel } from "@/components/analytics/PhilHealthAnalyticsPanel"
import { KioskAnalyticsPanel } from "@/components/analytics/KioskAnalyticsPanel"
import { DisplayAnalyticsPanel } from "@/components/analytics/DisplayAnalyticsPanel"
import { BranchPublicTokensPanel } from "@/components/analytics/BranchPublicTokensPanel"
import { ChartConditionPanel } from "@/components/analytics/ChartConditionPanel"
import { OrthoAnalyticsPanel } from "@/components/analytics/OrthoAnalyticsPanel"
import { BranchBenchmarkPanel } from "@/components/analytics/BranchBenchmarkPanel"
import { FinanceSummaryPanel } from "@/components/analytics/FinanceSummaryPanel"
import { ChairTimeAnalyticsPanel } from "@/components/analytics/ChairTimeAnalyticsPanel"
import { WorkflowSettingsLink } from "@/components/layout/WorkflowSettingsLink"

const PERIOD_OPTIONS = [7, 30, 90] as const
type PeriodDays = (typeof PERIOD_OPTIONS)[number]

export default function ReportsHubPage() {
  const { activeBranch } = useBranch()
  const { t, locale } = useLocale()
  const [periodDays, setPeriodDays] = useState<PeriodDays>(7)
  const { summary, loading, error, reload } = useReportsSummary(periodDays, locale)
  const { data: ownerAnalytics } = useOwnerAnalytics(periodDays, locale)
  const { stats } = useDashboardStats()

  const periodLabel = String(periodDays)
  const patientPeriodDays = periodDays < 30 ? 30 : periodDays

  const quickLinks = useMemo<ReportLink[]>(
    () => [
      {
        title: t("reports.linkAppointments", "Appointments"),
        description: t("reports.linkAppointmentsDesc", "Schedule, check-in, and day view"),
        href: "/appointments",
        icon: Calendar,
      },
      {
        title: t("reports.linkBilling", "Billing & invoices"),
        description: t("reports.linkBillingDesc", "Open invoices and payment ledger"),
        href: "/billing",
        icon: Receipt,
      },
      {
        title: t("reports.linkPatients", "Patient registry"),
        description: t("reports.linkPatientsDesc", "Demographics and consent status"),
        href: "/patients",
        icon: Users,
      },
      {
        title: t("reports.linkAudit", "Audit log"),
        description: t("reports.linkAuditDesc", "Compliance trail and CSV export"),
        href: "/settings/audit",
        icon: ScrollText,
      },
      {
        title: t("reports.linkCompliance", "Sterilization log"),
        description: t("reports.linkComplianceDesc", "Autoclave cycles and indicator results"),
        href: "/reports/compliance",
        icon: Shield,
      },
      {
        title: t("reports.linkInventory", "Inventory"),
        description: t("reports.linkInventoryDesc", "Stock levels and low-stock alerts"),
        href: "/inventory",
        icon: Package,
      },
    ],
    [t]
  )

  const metricPeriod = (key: string, fallback: string) =>
    t(key, fallback).replace("{days}", periodLabel)

  const hubMetrics = [
    {
      label: metricPeriod("reports.metricAppointments", "Appointments ({days}d)"),
      value: loading ? "—" : (summary?.totals.appointments ?? 0),
      hint: t("reports.metricAppointmentsOpen", "Open appointments calendar"),
      icon: Calendar,
      href: "/appointments",
    },
    {
      label: metricPeriod("reports.metricCompleted", "Completed ({days}d)"),
      value: loading ? "—" : (summary?.totals.completed ?? 0),
      hint: t("reports.metricCompletedOpen", "View completed visits"),
      icon: CheckCircle2,
      variant:
        (summary?.totals.completed ?? 0) > 0 && !loading ? ("success" as const) : ("default" as const),
      href: "/appointments",
    },
    {
      label: metricPeriod("reports.metricCollected", "Collected ({days}d)"),
      value: loading ? "—" : `₱${(summary?.totals.collected ?? 0).toLocaleString()}`,
      hint: t("reports.metricCollectedOpen", "Open billing ledger"),
      icon: Wallet,
      variant:
        (summary?.totals.collected ?? 0) > 0 && !loading ? ("success" as const) : ("default" as const),
      href: "/billing",
    },
    {
      label: metricPeriod("reports.metricNoShow", "No-shows ({days}d)"),
      value: loading ? "—" : (summary?.totals.noShow ?? 0),
      hint: t("reports.metricNoShowOpen", "Review appointments"),
      icon: XCircle,
      variant:
        (summary?.totals.noShow ?? 0) > 0 && !loading ? ("warning" as const) : ("default" as const),
      href: "/appointments",
    },
  ]

  const todayPulseMetrics = [
    {
      label: t("dashboard.todayAppointments", "Today's Appointments"),
      value: stats.today_appointments,
      hint: t("reports.metricAppointmentsOpen", "Open appointments calendar"),
      icon: Calendar,
      href: "/appointments",
    },
    {
      label: t("dashboard.collectedToday", "Collected Today"),
      value: `₱${stats.today_collected.toLocaleString()}`,
      hint: t("reports.metricCollectedOpen", "Open billing ledger"),
      icon: Wallet,
      variant: stats.today_collected > 0 ? ("success" as const) : ("default" as const),
      href: "/billing",
    },
    {
      label: t("dashboard.pendingConsents", "Pending Consents"),
      value: stats.pending_consents,
      hint: t("dashboard.pendingConsentsHint", "Awaiting patient signature"),
      icon: FileWarning,
      variant: stats.pending_consents > 0 ? ("warning" as const) : ("default" as const),
      href: "/patients?attention=consents",
    },
    {
      label: t("dashboard.openInvoices", "Open Invoices"),
      value: stats.open_invoices,
      hint: t("dashboard.viewBilling", "View billing"),
      icon: Receipt,
      variant: stats.open_invoices > 0 ? ("warning" as const) : ("default" as const),
      href: "/billing?focus=open",
    },
  ]

  function handleExportCsv() {
    if (!activeBranch || !summary) return
    const csv = buildReportsCsv({
      branchName: activeBranch.name,
      summary,
    })
    const slug = activeBranch.name.replace(/\s+/g, "-").toLowerCase()
    downloadReportsCsv(csv, `reports-${slug}-${periodDays}d-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const trendsTitle = metricPeriod("reports.sectionTrends", "{days}-day trends")
  const appointmentsChartTitle = metricPeriod(
    "reports.chartAppointments",
    "Appointments — last {days} days"
  )
  const collectionsChartTitle = metricPeriod(
    "reports.chartCollections",
    "Collections — last {days} days"
  )
  const statusEmptyLabel = metricPeriod(
    "reports.emptyStatus",
    "No appointments in the last {days} days"
  )

  return (
    <ModulePageShell
      eyebrow={t("reports.eyebrow", "Analytics") + " · " + t("reports.title", "Reports Hub")}
      icon={BarChart3}
      title={t("reports.title", "Reports Hub")}
      description={t(
        "reports.subtitle",
        "Open the branch once and review operations, chair flow, billing, claims, devices, and audit signals in one place."
      )}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50/80 p-0.5"
            role="group"
            aria-label={t("reports.periodLabel", "Report period")}
          >
            {PERIOD_OPTIONS.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setPeriodDays(days)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  periodDays === days
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-800"
                )}
              >
                {days}d
              </button>
            ))}
          </div>
          <WorkflowSettingsLink />
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!summary || loading}
            onClick={handleExportCsv}
          >
            <Download className="h-4 w-4" />
            {t("reports.exportCsv", "Export CSV")}
          </Button>
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <Link href="/reports/closeout">{t("reports.closeout", "Daily closeout")}</Link>
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => void reload()}>
            <RefreshCw className="h-4 w-4" />
            {t("reports.refresh", "Refresh")}
          </Button>
        </div>
      }
      badges={
        activeBranch ? (
          <Badge variant="info" className="gap-1 font-normal">
            <MapPin className="h-3 w-3" aria-hidden />
            {activeBranch.name}
          </Badge>
        ) : null
      }
      metrics={hubMetrics}
      error={error}
      onRetry={() => void reload()}
      retryLabel={t("common.retry", "Retry")}
      panelClassName="space-y-10"
    >
      {!activeBranch ? (
        <p className="text-sm text-neutral-500">
          {t("dashboard.selectBranch", "Select a branch to view stats")}
        </p>
      ) : null}

      {activeBranch ? (
        <ReportsSectionBlock
          icon={Clock3}
          eyebrow={t("reports.sectionToday", "Today")}
          title={t("reports.todayPulseTitle", "Today's pulse")}
          description={t(
            "reports.todayPulseDescription",
            "A quick read of today's front-desk load, collections, unsigned consents, and open balances."
          )}
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href="/">{t("reports.backDashboard", "Back to dashboard")}</Link>
            </Button>
          }
        >
          <MetricStrip items={todayPulseMetrics} />
        </ReportsSectionBlock>
      ) : null}

      <ReportsSectionBlock
        icon={TrendingUp}
        eyebrow={t("reports.sectionOverview", "Overview")}
        title={trendsTitle}
        description={t(
          "reports.sectionOverviewDescription",
          "Use these top-line charts to spot branch momentum fast: visit volume, cash movement, and appointment status mix."
        )}
      >
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/30 p-4">
            <h3 className="mb-1 text-sm font-semibold text-neutral-900">{appointmentsChartTitle}</h3>
            <p className="mb-3 text-xs text-neutral-500">
              {t("reports.chartAppointmentsHint", "How busy the calendar has been across the selected period.")}
            </p>
            <TrendLine
              data={(summary?.dailyAppointments ?? []).map((d) => ({ label: d.label, value: d.value }))}
              emptyLabel={t("dashboard.chartEmpty", "No activity in this period")}
              height={220}
            />
          </div>
          <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/30 p-4">
            <h3 className="mb-1 text-sm font-semibold text-neutral-900">{collectionsChartTitle}</h3>
            <p className="mb-3 text-xs text-neutral-500">
              {t("reports.chartCollectionsHint", "Payments posted each day for the active branch.")}
            </p>
            <TrendArea
              data={(summary?.dailyCollections ?? []).map((d) => ({ label: d.label, value: d.value }))}
              valueFormatter={(v) => (v >= 1000 ? `₱${(v / 1000).toFixed(1)}k` : `₱${v}`)}
              emptyLabel={t("dashboard.chartEmpty", "No activity in this period")}
              height={220}
            />
          </div>
          <div className="rounded-xl border border-neutral-200/80 bg-white p-4">
            <h3 className="mb-1 text-sm font-semibold text-neutral-900">
              {t("reports.sectionStatus", "Appointment mix")}
            </h3>
            <p className="mb-3 text-xs text-neutral-500">
              {t("reports.sectionStatusHint", "See whether the branch is completing visits or leaking them through no-shows and cancellations.")}
            </p>
            <StatusBreakdown slices={summary?.statusBreakdown ?? []} emptyLabel={statusEmptyLabel} />
            {summary && summary.totals.cancelled > 0 ? (
              <p className="mt-3 text-xs text-neutral-500">
                {t("reports.cancelledNote", "{count} cancelled in period").replace(
                  "{count}",
                  String(summary.totals.cancelled)
                )}
              </p>
            ) : null}
          </div>
        </div>

        {ownerAnalytics?.branchCompare && ownerAnalytics.branchCompare.length > 0 ? (
          <div className="rounded-xl border border-neutral-200/80 bg-white p-4">
            <h3 className="mb-1 text-sm font-semibold text-neutral-900">
              {t("reports.branchCompare", "Open invoices by branch")}
            </h3>
            <p className="mb-3 text-xs text-neutral-500">
              {t("reports.branchCompareHint", "Useful when owners want to see where AR pressure is accumulating across the group.")}
            </p>
            <DistributionPie
              data={ownerAnalytics.branchCompare}
              height={220}
              valueFormatter={(v) => String(v)}
              emptyLabel={t("dashboard.chartEmpty", "No activity in this period")}
            />
          </div>
        ) : null}
      </ReportsSectionBlock>

      {activeBranch ? (
        <ReportsSectionBlock
          icon={Calendar}
          eyebrow={t("reports.operationsEyebrow", "Operations")}
          title={t("reports.operationsTitle", "Reception, queue, and patient flow")}
          description={t(
            "reports.operationsDescription",
            "Track schedule occupancy, queue pressure, waitlist conversion, kiosk intake behavior, and chair-time efficiency from one section."
          )}
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href="/appointments">{t("reports.linkAppointments", "Appointments")}</Link>
            </Button>
          }
        >
          <div className="grid gap-4 2xl:grid-cols-2">
            <ReportPanelCaption
              title={t("reports.panelAppointmentsTitle", "Appointments and monthly booking board")}
              description={t(
                "reports.panelAppointmentsDescription",
                "Follow occupancy, no-shows, cancellations, and the read-only monthly booking board to see who is booked and what kind of visit is coming."
              )}
            >
              <AppointmentsAnalyticsPanel branchId={activeBranch.id} periodDays={periodDays} />
            </ReportPanelCaption>
            <ReportPanelCaption
              title={t("reports.panelQueueTitle", "Queue pressure")}
              description={t(
                "reports.panelQueueDescription",
                "Use this panel when the front desk needs to see whether arrivals are moving into chair time fast enough or whether staff handoffs are slowing down."
              )}
            >
              <QueueAnalyticsPanel branchId={activeBranch.id} periodDays={periodDays} />
            </ReportPanelCaption>
            <ReportPanelCaption
              title={t("reports.panelWaitlistTitle", "Waitlist recovery")}
              description={t(
                "reports.panelWaitlistDescription",
                "Shows how much demand is waiting off-calendar so staff can convert open slots into real visits instead of leaving chairs idle."
              )}
            >
              <WaitlistAnalyticsPanel branchId={activeBranch.id} periodDays={patientPeriodDays} />
            </ReportPanelCaption>
            <ReportPanelCaption
              title={t("reports.panelKioskTitle", "Kiosk and intake behavior")}
              description={t(
                "reports.panelKioskDescription",
                "Watch self-check-in and intake completion so reception can intervene before the patient reaches the dentist without a complete file."
              )}
            >
              <KioskAnalyticsPanel branchId={activeBranch.id} periodDays={periodDays} />
            </ReportPanelCaption>
            <ReportPanelCaption
              title={t("reports.panelChairTitle", "Chair-time efficiency")}
              description={t(
                "reports.panelChairDescription",
                "This view highlights how long the branch is spending in active treatment so owners can see whether schedule pressure is turning into productive chair time."
              )}
              className="2xl:col-span-2"
            >
              <ChairTimeAnalyticsPanel branchId={activeBranch.id} />
            </ReportPanelCaption>
          </div>
        </ReportsSectionBlock>
      ) : null}

      {activeBranch ? (
        <ReportsSectionBlock
          icon={Users}
          eyebrow={t("reports.clinicalEyebrow", "Clinical")}
          title={t("reports.clinicalTitle", "Patient and clinical quality")}
          description={t(
            "reports.clinicalDescription",
            "Review registry growth, consent completion, active chart findings, and orthodontic workload without opening each patient one by one."
          )}
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href="/patients">{t("reports.linkPatients", "Patient registry")}</Link>
            </Button>
          }
        >
          <div className="grid gap-4 2xl:grid-cols-2">
            <ReportPanelCaption
              title={t("reports.panelPatientsTitle", "Registry and consent health")}
              description={t(
                "reports.panelPatientsDescription",
                "See whether patient files are growing cleanly, whether consents are lagging, and where chart readiness may block the visit flow."
              )}
            >
              <PatientsAnalyticsPanel branchId={activeBranch.id} periodDays={patientPeriodDays} />
            </ReportPanelCaption>
            <ReportPanelCaption
              title={t("reports.panelChartTitle", "Dental chart findings")}
              description={t(
                "reports.panelChartDescription",
                "Review active chart conditions and unresolved findings so the branch can keep treatment planning anchored to current clinical reality."
              )}
            >
              <ChartConditionPanel branchId={activeBranch.id} />
            </ReportPanelCaption>
            <ReportPanelCaption
              title={t("reports.panelOrthoTitle", "Orthodontic follow-up load")}
              description={t(
                "reports.panelOrthoDescription",
                "This panel shows adjustment workload and future ortho follow-ups, which helps the team spot recurring specialty demand before it crowds general slots."
              )}
              className="2xl:col-span-2"
            >
              <OrthoAnalyticsPanel branchId={activeBranch.id} />
            </ReportPanelCaption>
          </div>
        </ReportsSectionBlock>
      ) : null}

      {activeBranch ? (
        <ReportsSectionBlock
          icon={Wallet}
          eyebrow={t("reports.financeEyebrow", "Finance")}
          title={t("reports.financeTitle", "Revenue, AR, and claims")}
          description={t(
            "reports.financeDescription",
            "This section combines daily collections, AR aging, HMO pipeline, and PhilHealth readiness so finance can act without hopping between modules."
          )}
          action={<WorkflowSettingsLink />}
        >
          <div className="space-y-4">
            <ReportPanelCaption
              title={t("reports.panelFinanceSummaryTitle", "Collections and accounts receivable")}
              description={t(
                "reports.panelFinanceSummaryDescription",
                "Use this summary to see whether money collected today is keeping up with open balances and whether billing follow-up should happen before day close."
              )}
            >
              <FinanceSummaryPanel branchId={activeBranch.id} />
            </ReportPanelCaption>
            <div className="grid gap-4 2xl:grid-cols-2">
              <ReportPanelCaption
                title={t("reports.panelHmoTitle", "HMO pipeline")}
                description={t(
                  "reports.panelHmoDescription",
                  "Shows claim volume and status so billing can see where reimbursements are stuck before AR quietly grows."
                )}
              >
                <HmoAnalyticsPanel branchId={activeBranch.id} />
              </ReportPanelCaption>
              <ReportPanelCaption
                title={t("reports.panelPhilHealthTitle", "PhilHealth readiness")}
                description={t(
                  "reports.panelPhilHealthDescription",
                  "Tracks pending claim preparation and readiness gaps so staff can clean up documentation before submission windows are missed."
                )}
              >
                <PhilHealthAnalyticsPanel branchId={activeBranch.id} />
              </ReportPanelCaption>
            </div>
          </div>
        </ReportsSectionBlock>
      ) : null}

      <ReportsSectionBlock
        icon={BarChart3}
        eyebrow={t("reports.benchmarkEyebrow", "Owner view")}
        title={t("reports.branchBenchmark", "Branch benchmark")}
        description={t(
          "reports.benchmarkDescription",
          "Compare branches across appointments and collections in the same period. This is the fastest way to spot underperforming sites."
        )}
      >
        <ReportPanelCaption
          title={t("reports.panelBenchmarkTitle", "Cross-branch performance")}
          description={t(
            "reports.panelBenchmarkDescription",
            "Owners can compare visit volume and collections side by side here instead of opening each branch one at a time."
          )}
        >
          <BranchBenchmarkPanel periodDays={periodDays} />
        </ReportPanelCaption>
      </ReportsSectionBlock>

      {activeBranch ? (
        <ReportsSectionBlock
          icon={Shield}
          eyebrow={t("reports.complianceEyebrow", "Compliance")}
          title={t("reports.complianceTitle", "Audit, stock, and messaging health")}
          description={t(
            "reports.complianceDescription",
            "Operational safety depends on more than visits. Watch stock risk, message delivery, and audit volume together."
          )}
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/reports/compliance">{t("reports.linkCompliance", "Sterilization log")}</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings/audit">{t("reports.linkAudit", "Audit log")}</Link>
              </Button>
            </div>
          }
        >
          <div className="grid gap-4 2xl:grid-cols-3">
            <ReportPanelCaption
              title={t("reports.panelInventoryTitle", "Inventory risk")}
              description={t(
                "reports.panelInventoryDescription",
                "Low stock and stock pressure appear here so the branch can prevent treatment interruptions caused by avoidable supply gaps."
              )}
            >
              <InventoryAnalyticsPanel branchId={activeBranch.id} />
            </ReportPanelCaption>
            <ReportPanelCaption
              title={t("reports.panelNotificationsTitle", "SMS delivery and messaging")}
              description={t(
                "reports.panelNotificationsDescription",
                "Watch template usage and delivery health to make sure reminders, recalls, and payment follow-ups actually reach patients."
              )}
            >
              <NotificationAnalyticsPanel branchId={activeBranch.id} periodDays={patientPeriodDays} />
            </ReportPanelCaption>
            <ReportPanelCaption
              title={t("reports.panelAuditTitle", "Audit activity")}
              description={t(
                "reports.panelAuditDescription",
                "This panel helps supervisors confirm that sensitive actions and operational changes are being logged at the right pace."
              )}
            >
              <AuditAnalyticsPanel branchId={activeBranch.id} periodDays={periodDays} />
            </ReportPanelCaption>
          </div>
        </ReportsSectionBlock>
      ) : null}

      {activeBranch ? (
        <ReportsSectionBlock
          icon={Monitor}
          eyebrow={t("reports.devicesEyebrow", "Patient-facing")}
          title={t("reports.devicesTitle", "Kiosk, TV display, and public-link controls")}
          description={t(
            "reports.devicesDescription",
            "Keep the waiting-room experience healthy: verify display heartbeat, check kiosk traffic, and close stale public tokens before they confuse staff."
          )}
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href="/display">{t("display.analyticsTitle", "Kiosk & TV display")}</Link>
            </Button>
          }
        >
          <div className="space-y-4">
            <ReportPanelCaption
              title={t("reports.panelDisplayTitle", "Display health")}
              description={t(
                "reports.panelDisplayDescription",
                "Monitor kiosk and TV status here so patients are not looking at stale queue information or a dead waiting-room screen."
              )}
            >
              <DisplayAnalyticsPanel branchId={activeBranch.id} />
            </ReportPanelCaption>
            <ReportPanelCaption
              title={t("reports.panelTokensTitle", "Public links and tokens")}
              description={t(
                "reports.panelTokensDescription",
                "Review branch public links and token state so staff can close stale access paths before they create front-desk confusion."
              )}
            >
              <BranchPublicTokensPanel branchId={activeBranch.id} />
            </ReportPanelCaption>
          </div>
        </ReportsSectionBlock>
      ) : null}

      <ReportsSectionBlock
        icon={ScrollText}
        eyebrow={t("reports.sectionModules", "Drill-down")}
        title={t("reports.sectionModulesTitle", "Jump into the source modules")}
        description={t(
          "reports.sectionModulesDescription",
          "These links open the operational screens where the numbers above are created, corrected, and closed."
        )}
      >
        <ReportQuickLinks links={quickLinks} />
        <p className="text-xs text-neutral-500">
          {t("reports.auditPermissionNote", "Audit log access depends on your role permissions.")}
        </p>
      </ReportsSectionBlock>
    </ModulePageShell>
  )
}
