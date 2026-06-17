"use client"

import { OpsSummaryGrid } from "@/components/layout/OpsSummaryGrid"
import { useLocale } from "@/hooks/use-locale"

type BillingOpsSummaryProps = {
  total: number
  open: number
  outstanding: number
  paid: number
  overdue?: number
  loading?: boolean
  branchName?: string | null
}

export function BillingOpsSummary({
  total,
  open,
  outstanding,
  paid,
  overdue = 0,
  loading,
  branchName,
}: BillingOpsSummaryProps) {
  const { t } = useLocale()

  return (
    <OpsSummaryGrid
      title={t("billing.opsSummaryTitle", "Billing summary")}
      subtitle={branchName ?? t("dashboard.selectBranch", "Select a branch")}
      items={[
        {
          label: t("billing.metricTotal", "Invoices"),
          value: loading ? "—" : total,
          sub: t("billing.summaryTotalSub", "All statuses"),
        },
        {
          label: t("billing.filterOpen", "Open"),
          value: loading ? "—" : open,
          sub: t("billing.metricOpenHint", "Tap to filter open"),
          emphasis: !loading && open > 0 ? "warning" : "default",
          href: "/billing?focus=open",
        },
        {
          label: t("billing.overdue", "Overdue"),
          value: loading ? "—" : overdue,
          sub: t("billing.metricOverdueHint", "Past due — tap to filter"),
          emphasis: !loading && overdue > 0 ? "warning" : "default",
          href: "/billing?focus=overdue",
        },
        {
          label: t("billing.balance", "Outstanding"),
          value: loading ? "—" : `₱${outstanding.toLocaleString()}`,
          sub: t("billing.metricOutstandingHint", "Unpaid total"),
          emphasis: !loading && outstanding > 0 ? "warning" : "default",
        },
        {
          label: t("billing.filterPaid", "Paid"),
          value: loading ? "—" : paid,
          sub: t("billing.metricPaidHint", "Fully settled"),
          emphasis: !loading && paid > 0 ? "success" : "default",
        },
      ]}
      columnsClassName="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
    />
  )
}
