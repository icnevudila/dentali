"use client"

import Link from "next/link"
import {
  BarChart3,
  Users,
  Receipt,
  ClipboardList,
  Package,
  Bell,
  Monitor,
  Stethoscope,
  Timer,
  ArrowRight,
} from "lucide-react"
import { useLocale } from "@/hooks/use-locale"
import { useDashboardAnalytics } from "@/hooks/use-dashboard-analytics"
import type { ReportsSummary } from "@/lib/reports/reports-service"
import { ModuleAnalyticsPanel } from "@/components/analytics/ModuleAnalyticsPanel"
import { HorizontalSnapStrip } from "@/components/layout/HorizontalSnapStrip"
import { MetricStrip } from "@/components/layout/MetricStrip"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type DashboardExtendedReportsProps = {
  branchId: string
  periodDays: 7 | 30 | 90
  reportsSummary: ReportsSummary | null
  summaryLoading: boolean
  className?: string
}

function ReportSection({
  title,
  icon: Icon,
  children,
  href,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  href: string
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary-600" aria-hidden />
          <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
        </div>
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
        >
          Details
          <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>
      {children}
    </section>
  )
}

export function DashboardExtendedReports({
  periodDays,
  reportsSummary,
  summaryLoading,
  className,
}: Omit<DashboardExtendedReportsProps, "branchId"> & { branchId?: string }) {
  const { t } = useLocale()
  const { data, loading } = useDashboardAnalytics(periodDays)
  const periodLabel = String(periodDays)
  const busy = loading || summaryLoading

  const noShowRate =
    reportsSummary && reportsSummary.totals.appointments > 0
      ? Math.round((reportsSummary.totals.noShow / reportsSummary.totals.appointments) * 100)
      : 0

  const completionRate =
    reportsSummary && reportsSummary.totals.appointments > 0
      ? Math.round((reportsSummary.totals.completed / reportsSummary.totals.appointments) * 100)
      : 0

  const periodMetrics = [
    {
      label: t("dashboard.periodAppointments", "Appointments"),
      value: busy || !reportsSummary ? "—" : reportsSummary.totals.appointments,
      hint: t("dashboard.periodAppointmentsHint", "Last {days} days").replace("{days}", periodLabel),
    },
    {
      label: t("dashboard.periodCompleted", "Completed"),
      value: busy || !reportsSummary ? "—" : reportsSummary.totals.completed,
      hint: `${completionRate}% ${t("dashboard.completionRate", "completion")}`,
      variant: completionRate >= 70 ? ("success" as const) : ("default" as const),
    },
    {
      label: t("dashboard.periodCollected", "Collected"),
      value:
        busy || !reportsSummary
          ? "—"
          : `₱${reportsSummary.totals.collected.toLocaleString()}`,
      hint: t("dashboard.periodCollectedHint", "Payments in period"),
      variant: !busy && reportsSummary && reportsSummary.totals.collected > 0 ? ("success" as const) : ("default" as const),
    },
    {
      label: t("dashboard.periodNoShow", "No-shows"),
      value: busy || !reportsSummary ? "—" : reportsSummary.totals.noShow,
      hint: `${noShowRate}% ${t("dashboard.ofScheduled", "of scheduled")}`,
      variant: noShowRate > 10 ? ("warning" as const) : ("default" as const),
    },
    {
      label: t("queue.medianWait", "Median wait ({days}d)").replace("{days}", periodLabel),
      value: busy ? "—" : `${data.queue?.medianWaitMinutes ?? 0} min`,
      hint: t("dashboard.queueWaitHint", "Check-in to called"),
    },
    {
      label: t("appointments.occupancy", "Chair occupancy"),
      value: busy ? "—" : `${data.appointments?.occupancyPct ?? 0}%`,
      hint: t("dashboard.occupancyHint", "Scheduled slots used"),
    },
    {
      label: t("finance.openAr", "Open AR"),
      value: busy ? "—" : `₱${(data.finance?.openAr ?? 0).toLocaleString()}`,
      hint: t("finance.openInvoices", "Open invoices"),
    },
    {
      label: t("patients.consentCompletion", "Consent rate"),
      value: busy ? "—" : `${data.patients?.consentCompletionPct ?? 0}%`,
      hint: t("patients.activeRegistry", "Active registry"),
    },
  ]

  return (
    <div className={cn("space-y-8", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-neutral-950">
            {t("dashboard.extendedReportsTitle", "Branch reports")}
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            {t(
              "dashboard.extendedReportsSubtitle",
              "Operations, finance, patients, and compliance — last {days} days at this branch."
            ).replace("{days}", periodLabel)}
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" asChild>
          <Link href={`/reports?period=${periodDays}#overview`}>
            <BarChart3 className="h-3.5 w-3.5" aria-hidden />
            {t("dashboard.openReportsHub", "Full reports hub")}
          </Link>
        </Button>
      </div>

      <MetricStrip items={periodMetrics} className="sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4" />

      <ReportSection
        title={t("dashboard.reportOpsTitle", "Queue & appointments")}
        icon={Timer}
        href={`/reports?period=${periodDays}#operations`}
      >
        <HorizontalSnapStrip desktopCols={3}>
          <ModuleAnalyticsPanel
            title={t("queue.peakHours", "Peak check-in hours")}
            variant="bar"
            data={data.queue?.peakHours ?? []}
            loading={busy}
            height={160}
          />
          <ModuleAnalyticsPanel
            title={t("queue.todayFlow", "Today's queue flow")}
            variant="funnel"
            funnelSteps={(data.queue?.todayFlow ?? []).map((s) => ({
              label: s.label,
              value: s.value,
            }))}
            loading={busy}
          />
          <ModuleAnalyticsPanel
            title={t("appointments.hourlyLoad", "Hourly appointment load")}
            variant="bar"
            data={data.appointments?.hourlyLoad ?? []}
            loading={busy}
            height={160}
          />
          <ModuleAnalyticsPanel
            title={t("appointments.noShowTrend", "No-show trend")}
            variant="line"
            data={(data.appointments?.noShowTrend ?? []).map((d) => ({
              label: d.label,
              value: d.value,
            }))}
            loading={busy}
            height={160}
          />
          <ModuleAnalyticsPanel
            title={t("appointments.cancelTrend", "Cancellation trend")}
            variant="area"
            data={(data.appointments?.cancelTrend ?? []).map((d) => ({
              label: d.label,
              value: d.value,
            }))}
            loading={busy}
            height={160}
          />
          <ModuleAnalyticsPanel
            title={t("appointments.providerUtilization", "Provider utilization")}
            variant="bar"
            data={data.appointments?.providerUtilization ?? []}
            loading={busy}
            height={160}
          />
        </HorizontalSnapStrip>
      </ReportSection>

      <ReportSection
        title={t("dashboard.reportFinanceTitle", "Finance & receivables")}
        icon={Receipt}
        href={`/reports?period=${periodDays}#finance`}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: t("finance.openAr", "Open AR"),
              value: `₱${(data.finance?.openAr ?? 0).toLocaleString()}`,
            },
            {
              label: t("finance.openInvoices", "Open invoices"),
              value: data.finance?.openInvoiceCount ?? 0,
            },
            {
              label: t("finance.hmoPending", "HMO pending"),
              value: `₱${(data.finance?.hmoPendingAmount ?? 0).toLocaleString()}`,
            },
            {
              label: t("finance.hmoDrafts", "HMO drafts"),
              value: data.finance?.hmoDraftCount ?? 0,
              warn: (data.finance?.hmoDraftCount ?? 0) > 0,
            },
          ].map((card) => (
            <div
              key={card.label}
              className={cn(
                "rounded-xl border px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]",
                card.warn
                  ? "border-amber-200/80 bg-amber-50/40"
                  : "border-neutral-200/80 bg-white"
              )}
            >
              <p className="text-xs font-medium text-neutral-500">{card.label}</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-neutral-900">
                {busy ? "—" : card.value}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ModuleAnalyticsPanel
            title={t("billing.arAging", "Open balance aging")}
            subtitle={t("billing.arAgingHint", "Outstanding invoices by age")}
            variant="bar"
            data={data.finance?.arAging ?? []}
            loading={busy}
            valueFormatter={(v) => `₱${v.toLocaleString()}`}
            height={180}
          />
          <ModuleAnalyticsPanel
            title={t("reports.hmoPipeline", "HMO claim pipeline")}
            variant="funnel"
            funnelSteps={(data.hmo?.statusFunnel ?? []).map((s) => ({
              label: s.label,
              value: s.value,
            }))}
            loading={busy}
          />
        </div>
      </ReportSection>

      <ReportSection
        title={t("dashboard.reportPatientsTitle", "Patients & waitlist")}
        icon={Users}
        href={`/reports?period=${periodDays}#clinical`}
      >
        <HorizontalSnapStrip desktopCols={3}>
          <ModuleAnalyticsPanel
            title={t("patients.newPatientsTrend", "New patient registrations")}
            variant="area"
            data={(data.patients?.newPatientsTrend ?? []).map((d) => ({
              label: d.label,
              value: d.value,
            }))}
            loading={busy}
            height={160}
          />
          <ModuleAnalyticsPanel
            title={t("waitlist.statusFunnel", "Waitlist funnel")}
            variant="funnel"
            funnelSteps={(data.waitlist?.statusFunnel ?? []).map((s) => ({
              label: s.label,
              value: s.value,
            }))}
            loading={busy}
          />
          <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <p className="text-xs font-medium text-neutral-500">
              {t("waitlist.conversionRate", "Waitlist conversion")}
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-neutral-900">
              {busy ? "—" : `${data.waitlist?.conversionPct ?? 0}%`}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {busy
                ? "—"
                : `${data.waitlist?.activeWaiting ?? 0} ${t("waitlist.activeWaiting", "actively waiting")}`}
            </p>
          </div>
          <ModuleAnalyticsPanel
            title={t("reports.chartConditions", "Chart findings mix")}
            subtitle={
              busy
                ? undefined
                : `${data.chartConditions.totalFindings} ${t("reports.totalFindings", "findings logged")}`
            }
            variant="pie"
            data={data.chartConditions.items}
            loading={busy}
            height={160}
          />
          <ModuleAnalyticsPanel
            title={t("ortho.activeCases", "Active ortho cases")}
            variant="bar"
            data={data.ortho?.balanceDistribution ?? []}
            loading={busy}
            height={160}
          />
        </HorizontalSnapStrip>
      </ReportSection>

      <ReportSection
        title={t("dashboard.reportComplianceTitle", "Claims, stock & outreach")}
        icon={ClipboardList}
        href={`/reports?period=${periodDays}#compliance`}
      >
        <HorizontalSnapStrip desktopCols={3}>
          <ModuleAnalyticsPanel
            title={t("philhealth.statusMix", "PhilHealth claims")}
            variant="pie"
            data={data.philhealth?.statusBreakdown ?? []}
            loading={busy}
            height={160}
          />
          <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <p className="text-xs font-medium text-neutral-500">
              {t("philhealth.readiness", "PhilHealth readiness")}
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-neutral-900">
              {busy ? "—" : `${data.philhealth?.readinessPct ?? 0}%`}
            </p>
          </div>
          <ModuleAnalyticsPanel
            title={t("inventory.stockLevels", "Inventory levels")}
            variant="bar"
            data={data.inventory?.stockLevels ?? []}
            loading={busy}
            height={160}
          />
          <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="flex items-start gap-2">
              <Package className="mt-0.5 h-4 w-4 text-amber-600" aria-hidden />
              <div>
                <p className="text-xs font-medium text-neutral-500">
                  {t("inventory.lowStock", "Low stock SKUs")}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-amber-900">
                  {busy ? "—" : data.inventory?.lowStockCount ?? 0}
                </p>
                <p className="text-xs text-neutral-500">
                  {busy ? "—" : `${data.inventory?.totalSkus ?? 0} SKUs tracked`}
                </p>
              </div>
            </div>
          </div>
          <ModuleAnalyticsPanel
            title={t("notifications.deliveryTrend", "SMS / notification delivery")}
            variant="area"
            data={(data.notifications?.dailyDelivery ?? []).map((d) => ({
              label: d.label,
              value: d.value,
            }))}
            loading={busy}
            height={160}
          />
          <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="flex items-start gap-2">
              <Bell className="mt-0.5 h-4 w-4 text-primary-600" aria-hidden />
              <div>
                <p className="text-xs font-medium text-neutral-500">
                  {t("notifications.deliveryRate", "Delivery rate")}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {busy ? "—" : `${data.notifications?.deliveryRatePct ?? 0}%`}
                </p>
              </div>
            </div>
          </div>
        </HorizontalSnapStrip>
      </ReportSection>

      <ReportSection
        title={t("dashboard.reportDevicesTitle", "Kiosk & patient-facing")}
        icon={Monitor}
        href={`/reports?period=${periodDays}#devices`}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ModuleAnalyticsPanel
            title={t("kiosk.dailyCheckins", "Kiosk check-ins")}
            variant="line"
            data={(data.kiosk?.dailyCheckins ?? []).map((d) => ({
              label: d.label,
              value: d.value,
            }))}
            loading={busy}
            height={150}
          />
          <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="flex items-start gap-2">
              <Stethoscope className="mt-0.5 h-4 w-4 text-primary-600" aria-hidden />
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-neutral-500">
                    {t("kiosk.periodCheckins", "Kiosk arrivals ({days}d)").replace("{days}", periodLabel)}
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">
                    {busy ? "—" : data.kiosk?.totalPeriod ?? 0}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500">
                    {t("kiosk.intakesPeriod", "New patient intakes")}
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {busy ? "—" : data.kiosk?.intakesPeriod ?? 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ReportSection>
    </div>
  )
}
