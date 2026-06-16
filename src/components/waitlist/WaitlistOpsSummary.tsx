"use client"

import { OpsSummaryGrid } from "@/components/layout/OpsSummaryGrid"
import { useLocale } from "@/hooks/use-locale"

type WaitlistOpsSummaryProps = {
  activeCount: number
  waitingCount: number
  contactedCount: number
  historyCount?: number
  tab: "active" | "history"
  loading?: boolean
}

export function WaitlistOpsSummary({
  activeCount,
  waitingCount,
  contactedCount,
  historyCount = 0,
  tab,
  loading,
}: WaitlistOpsSummaryProps) {
  const { t } = useLocale()

  if (tab === "history") {
    return (
      <OpsSummaryGrid
        title={t("waitlist.historySummaryTitle", "Waitlist history")}
        items={[
          {
            label: t("waitlist.history", "History"),
            value: loading ? "—" : historyCount,
            sub: t("waitlist.metricHistoryHint", "Booked, cancelled, expired"),
          },
        ]}
        columnsClassName="sm:grid-cols-1 lg:grid-cols-2"
      />
    )
  }

  return (
    <OpsSummaryGrid
      title={t("waitlist.activeSummaryTitle", "Active waitlist")}
      subtitle={t("waitlist.activeSummarySubtitle", "FIFO with urgency when slots open")}
      items={[
        {
          label: t("waitlist.active", "Active"),
          value: loading ? "—" : activeCount,
          sub: t("waitlist.metricActiveHint", "On waitlist now"),
        },
        {
          label: t("waitlist.metricWaiting", "Waiting"),
          value: loading ? "—" : waitingCount,
          sub: t("waitlist.metricWaitingHint", "Not yet contacted"),
          emphasis: !loading && waitingCount > 0 ? "warning" : "default",
        },
        {
          label: t("waitlist.metricContacted", "Contacted"),
          value: loading ? "—" : contactedCount,
          sub: t("waitlist.metricContactedHint", "Follow-up in progress"),
        },
      ]}
      columnsClassName="sm:grid-cols-2 lg:grid-cols-3"
    />
  )
}
