"use client"

import { OpsSummaryGrid } from "@/components/layout/OpsSummaryGrid"
import { useLocale } from "@/hooks/use-locale"
import { cn } from "@/lib/utils"

export type QueueDayStats = {
  checkedIn: number
  active: number
  waiting: number
  serving: number
  served: number
  cancelled: number
  avgWaitActive: number
  avgVisitMins: number
}

type QueueDaySummaryProps = {
  stats: QueueDayStats
  isToday: boolean
  formattedDay: string
  prevDayServed?: number | null
  arrivalsPending?: number
  className?: string
  activeKey?: QueueDaySummaryKey | null
  onItemClick?: (key: QueueDaySummaryKey) => void
  arrivalsHref?: string
}

export type QueueDaySummaryKey =
  | "arrivals"
  | "checked_in"
  | "active"
  | "waiting"
  | "serving"
  | "served"
  | "cancelled"

export function QueueDaySummary({
  stats,
  isToday,
  formattedDay,
  prevDayServed,
  arrivalsPending = 0,
  className,
  activeKey = null,
  onItemClick,
  arrivalsHref,
}: QueueDaySummaryProps) {
  const { t } = useLocale()

  const cell = (
    key: QueueDaySummaryKey,
    item: {
      label: string
      value: string | number
      sub?: string
      emphasis?: "default" | "warning" | "success"
      href?: string
    }
  ) => ({
    ...item,
    active: activeKey === key,
    onClick: onItemClick ? () => onItemClick(key) : undefined,
    href: key === "arrivals" && !onItemClick ? arrivalsHref : item.href,
  })

  const servedDelta =
    isToday && prevDayServed != null ? stats.served - prevDayServed : null

  const compareSubtitle =
    isToday && prevDayServed != null
      ? [
          t("queue.servedVsYesterday", "Served yesterday: {prev}").replace(
            "{prev}",
            String(prevDayServed)
          ),
          servedDelta != null && servedDelta !== 0
            ? `(${servedDelta > 0 ? "+" : ""}${servedDelta} ${t("queue.vsYesterdayShort", "vs yesterday")})`
            : null,
        ]
          .filter(Boolean)
          .join(" ")
      : null

  return (
    <OpsSummaryGrid
      className={cn(className)}
      title={
        isToday
          ? t("queue.daySummaryToday", "Today's queue summary")
          : t("queue.daySummaryPast", "Queue summary — {day}").replace("{day}", formattedDay)
      }
      subtitle={compareSubtitle}
      items={[
        ...(isToday
          ? [
              cell("arrivals", {
                label: t("queue.summaryArrivals", "To check in"),
                value: arrivalsPending,
                sub: t("queue.summaryArrivalsSub", "Scheduled, not in queue"),
                emphasis: arrivalsPending > 0 ? ("warning" as const) : ("default" as const),
              }),
            ]
          : []),
        cell("checked_in", {
          label: t("queue.summaryCheckedIn", "Checked in"),
          value: stats.checkedIn,
          sub: onItemClick
            ? t("queue.summaryTapFilter", "Tap to show all")
            : t("queue.summaryCheckedInSub", "Total visits this day"),
        }),
        cell("active", {
          label: t("queue.summaryActive", "Active now"),
          value: stats.active,
          sub: isToday
            ? onItemClick
              ? t("queue.summaryTapActive", "Tap to filter live board")
              : t("queue.summaryActiveSub", "On the live board")
            : t("queue.summaryActivePast", "Unfinished at EOD"),
          emphasis: isToday && stats.active > 0 ? "warning" : "default",
        }),
        cell("waiting", {
          label: t("queue.summaryWaiting", "Waiting"),
          value: stats.waiting,
          sub: onItemClick ? t("queue.summaryTapWaiting", "Tap to filter waiting") : undefined,
        }),
        cell("serving", {
          label: t("queue.summaryServing", "Called / chair"),
          value: stats.serving,
          sub: onItemClick ? t("queue.summaryTapServing", "Tap to filter called") : undefined,
        }),
        cell("served", {
          label: t("queue.summaryServed", "Served"),
          value: stats.served,
          emphasis: stats.served > 0 ? "success" : "default",
          sub: onItemClick ? t("queue.summaryTapServed", "Tap to filter completed") : undefined,
        }),
        cell("cancelled", {
          label: t("queue.summaryCancelled", "Cancelled"),
          value: stats.cancelled,
        }),
        {
          label: isToday ? t("queue.avgWait", "Avg wait") : t("queue.avgVisit", "Avg visit"),
          value: isToday
            ? stats.active > 0
              ? `${stats.avgWaitActive} min`
              : "—"
            : stats.served > 0
              ? `${stats.avgVisitMins} min`
              : "—",
          sub: isToday
            ? t("queue.summaryAvgWaitSub", "Active patients")
            : t("queue.summaryAvgVisitSub", "Check-in to complete"),
        },
      ]}
    />
  )
}
