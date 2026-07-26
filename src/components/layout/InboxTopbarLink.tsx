"use client"

import * as React from "react"
import Link from "next/link"
import { Inbox } from "lucide-react"
import { useLocale } from "@/hooks/use-locale"
import { useDashboardStats } from "@/hooks/use-dashboard-stats"
import { useReportsSummary } from "@/hooks/use-reports-summary"
import { countInboxFollowUps } from "@/lib/dashboard/inbox-counts"
import { cn } from "@/lib/utils"

export function InboxTopbarLink({ className }: { className?: string }) {
  const { t, locale } = useLocale()
  const { stats } = useDashboardStats()
  const { summary } = useReportsSummary(7, locale)
  const count = countInboxFollowUps(stats, summary?.totals.noShow ?? 0)

  return (
    <Link
      href="/inbox"
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900",
        className
      )}
      aria-label={
        count > 0
          ? `${t("nav.inbox", "Inbox")} (${count})`
          : t("nav.inbox", "Inbox")
      }
    >
      <Inbox className="h-4.5 w-4.5 h-4 w-4" aria-hidden />
      {count > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white tabular-nums">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  )
}
