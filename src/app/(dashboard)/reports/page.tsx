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
} from "lucide-react"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { SectionEyebrow } from "@/components/layout/SectionEyebrow"
import { TrendArea, TrendLine, DistributionPie } from "@/components/charts/ChartKit"
import { useOwnerAnalytics } from "@/hooks/use-owner-analytics"
import { StatusBreakdown } from "@/components/charts/StatusBreakdown"
import { ReportQuickLinks, type ReportLink } from "@/components/reports/ReportQuickLinks"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { useReportsSummary } from "@/hooks/use-reports-summary"
import { useDashboardStats } from "@/hooks/use-dashboard-stats"
import { buildReportsCsv, downloadReportsCsv } from "@/lib/reports/reports-export"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { OrthoAnalyticsPanel } from "@/components/analytics/OrthoAnalyticsPanel"
import { BranchBenchmarkPanel } from "@/components/analytics/BranchBenchmarkPanel"
import { FinanceSummaryPanel } from "@/components/analytics/FinanceSummaryPanel"
import { HmoAnalyticsPanel } from "@/components/analytics/HmoAnalyticsPanel"
import { ChairTimeAnalyticsPanel } from "@/components/analytics/ChairTimeAnalyticsPanel"
import { Timer } from "lucide-react"

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
      hint: t("reports.metricAppointmentsHint", "Scheduled in period"),
      icon: Calendar,
    },
    {
      label: metricPeriod("reports.metricCompleted", "Completed ({days}d)"),
      value: loading ? "—" : (summary?.totals.completed ?? 0),
      hint: t("reports.metricCompletedHint", "Marked done"),
      icon: CheckCircle2,
      variant: (summary?.totals.completed ?? 0) > 0 && !loading ? ("success" as const) : ("default" as const),
    },
    {
      label: metricPeriod("reports.metricCollected", "Collected ({days}d)"),
      value: loading ? "—" : `₱${(summary?.totals.collected ?? 0).toLocaleString()}`,
      hint: t("reports.metricCollectedHint", "Payments recorded"),
      icon: Wallet,
      variant: (summary?.totals.collected ?? 0) > 0 && !loading ? ("success" as const) : ("default" as const),
    },
    {
      label: metricPeriod("reports.metricNoShow", "No-shows ({days}d)"),
      value: loading ? "—" : (summary?.totals.noShow ?? 0),
      hint: t("reports.metricNoShowHint", "Missed appointments"),
      icon: XCircle,
      variant: (summary?.totals.noShow ?? 0) > 0 && !loading ? ("warning" as const) : ("default" as const),
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
        "Trends, collections, and operational snapshots — drill down into modules or export audit data."
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
      panelClassName="space-y-8"
    >
      {!activeBranch ? (
        <p className="text-sm text-neutral-500">{t("dashboard.selectBranch", "Select a branch to view stats")}</p>
      ) : null}

      <section className="space-y-3">
        <SectionEyebrow icon={TrendingUp}>{trendsTitle}</SectionEyebrow>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/30 p-4">
            <h3 className="mb-3 text-sm font-semibold text-neutral-900">{appointmentsChartTitle}</h3>
            <TrendLine
              data={(summary?.dailyAppointments ?? []).map((d) => ({ label: d.label, value: d.value }))}
              emptyLabel={t("dashboard.chartEmpty", "No activity in this period")}
              height={220}
            />
          </div>
          <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/30 p-4">
            <h3 className="mb-3 text-sm font-semibold text-neutral-900">{collectionsChartTitle}</h3>
            <TrendArea
              data={(summary?.dailyCollections ?? []).map((d) => ({ label: d.label, value: d.value }))}
              valueFormatter={(v) => (v >= 1000 ? `₱${(v / 1000).toFixed(1)}k` : `₱${v}`)}
              emptyLabel={t("dashboard.chartEmpty", "No activity in this period")}
              height={220}
            />
          </div>
        </div>
      </section>

      {ownerAnalytics?.branchCompare && ownerAnalytics.branchCompare.length > 0 ? (
        <section className="space-y-3">
          <SectionEyebrow icon={BarChart3}>
            {t("reports.branchCompare", "Open invoices by branch")}
          </SectionEyebrow>
          <div className="rounded-xl border border-neutral-200/80 bg-white p-4">
            <DistributionPie
              data={ownerAnalytics.branchCompare}
              height={220}
              valueFormatter={(v) => String(v)}
              emptyLabel={t("dashboard.chartEmpty", "No activity in this period")}
            />
          </div>
        </section>
      ) : null}

      {activeBranch ? (
        <section className="space-y-3">
          <SectionEyebrow icon={Timer}>
            {t("chairtime.title", "Real-Time Chair Efficiency (Chair-Time Tracker)")}
          </SectionEyebrow>
          <ChairTimeAnalyticsPanel branchId={activeBranch.id} />
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionEyebrow icon={BarChart3}>
          {t("reports.branchBenchmark", "Branch benchmark")}
        </SectionEyebrow>
        <BranchBenchmarkPanel periodDays={periodDays} />
      </section>

      {activeBranch ? (
        <section className="space-y-3">
          <SectionEyebrow icon={Wallet}>
            {t("reports.financeSummary", "Finance summary")}
          </SectionEyebrow>
          <FinanceSummaryPanel branchId={activeBranch.id} />
        </section>
      ) : null}

      {activeBranch ? (
        <section className="space-y-3">
          <SectionEyebrow icon={Receipt}>
            {t("reports.hmoClaimsSection", "HMO claims & open AR")}
          </SectionEyebrow>
          <HmoAnalyticsPanel branchId={activeBranch.id} />
        </section>
      ) : null}

      {activeBranch ? (
        <section className="space-y-3">
          <SectionEyebrow icon={Users}>{t("reports.orthoSection", "Orthodontics")}</SectionEyebrow>
          <OrthoAnalyticsPanel branchId={activeBranch.id} />
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionEyebrow icon={Calendar}>{t("reports.sectionStatus", "Appointment mix")}</SectionEyebrow>
        <div className="rounded-xl border border-neutral-200/80 bg-white p-4">
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
      </section>

      <section className="space-y-3">
        <SectionEyebrow icon={BarChart3}>{t("reports.sectionToday", "Today's pulse")}</SectionEyebrow>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3">
            <p className="text-xs text-neutral-500">{t("dashboard.todayAppointments", "Today's Appointments")}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{stats.today_appointments}</p>
          </div>
          <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3">
            <p className="text-xs text-neutral-500">{t("dashboard.collectedToday", "Collected Today")}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">₱{stats.today_collected.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 px-4 py-3">
            <p className="text-xs text-neutral-500">{t("dashboard.pendingConsents", "Pending Consents")}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-amber-900">{stats.pending_consents}</p>
          </div>
          <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3">
            <p className="text-xs text-neutral-500">{t("dashboard.openInvoices", "Open Invoices")}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{stats.open_invoices}</p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SectionEyebrow icon={ScrollText}>{t("reports.sectionModules", "Drill-down modules")}</SectionEyebrow>
        <ReportQuickLinks links={quickLinks} />
        <p className="text-xs text-neutral-500">
          {t("reports.auditPermissionNote", "Audit log access depends on your role permissions.")}
        </p>
      </section>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" asChild>
          <Link href="/">{t("reports.backDashboard", "Back to dashboard")}</Link>
        </Button>
      </div>
    </ModulePageShell>
  )
}
