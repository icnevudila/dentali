"use client"

import * as React from "react"
import Link from "next/link"
import { Wallet, ArrowRight, FileWarning } from "lucide-react"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { fetchDailyCloseout, type DailyCloseout } from "@/lib/analytics/analytics-service"
import type { DashboardStats } from "@/lib/dashboard/dashboard-service"
import { useOperationalRefresh } from "@/hooks/use-operational-refresh"
import { NAV_FORWARD_TRANSITION } from "@/lib/navigation/view-transition"
import { cn } from "@/lib/utils"

export function DailyCloseoutCard({
  className,
  stats,
}: {
  className?: string
  stats: DashboardStats
}) {
  const { activeBranch } = useBranch()
  const { t } = useLocale()
  const [closeout, setCloseout] = React.useState<DailyCloseout | null>(null)
  const [loading, setLoading] = React.useState(true)

  const reload = React.useCallback(async () => {
    if (!activeBranch) return
    setLoading(true)
    const { data } = await fetchDailyCloseout(activeBranch.id)
    setCloseout(data)
    setLoading(false)
  }, [activeBranch])

  React.useEffect(() => {
    void reload()
  }, [reload])

  useOperationalRefresh(
    ["invoices", "invoice_payments", "appointments"],
    () => {
      void reload()
    }
  )

  if (!activeBranch) return null

  const collected = closeout?.collected ?? stats.today_collected
  const openBalance = closeout?.openBalance ?? 0
  const missingNotes = stats.missing_clinical_notes

  return (
    <Link
      href="/reports/closeout"
      transitionTypes={NAV_FORWARD_TRANSITION}
      className={cn(
        "group block rounded-xl border border-neutral-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-colors hover:border-primary-200 hover:bg-primary-50/30",
        className
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary-600" aria-hidden />
          <h3 className="text-sm font-semibold text-neutral-900">
            {t("dashboard.closeoutCardTitle", "Daily closeout")}
          </h3>
        </div>
        <ArrowRight
          className="h-4 w-4 text-neutral-400 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-600"
          aria-hidden
        />
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-lg font-bold tabular-nums text-neutral-900">
            {loading ? "—" : `₱${collected.toLocaleString()}`}
          </p>
          <p className="text-[11px] text-neutral-500">{t("dashboard.collectedToday", "Collected Today")}</p>
        </div>
        <div>
          <p
            className={cn(
              "text-lg font-bold tabular-nums",
              openBalance > 0 ? "text-amber-700" : "text-neutral-900"
            )}
          >
            {loading ? "—" : `₱${openBalance.toLocaleString()}`}
          </p>
          <p className="text-[11px] text-neutral-500">{t("closeout.openBalance", "Open balance")}</p>
        </div>
        <div>
          <p
            className={cn(
              "text-lg font-bold tabular-nums",
              missingNotes > 0 ? "text-amber-700" : "text-neutral-900"
            )}
          >
            {missingNotes}
          </p>
          <p className="flex items-center justify-center gap-0.5 text-[11px] text-neutral-500">
            {missingNotes > 0 ? <FileWarning className="h-3 w-3 text-amber-600" /> : null}
            {t("dashboard.missingNotes", "Missing clinical notes")}
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs text-neutral-500">
        {t("dashboard.closeoutCardHint", "End-of-day summary — tap to open full closeout report")}
      </p>

      {!loading && (openBalance > 0 || missingNotes > 0) ? (
        <p className="mt-2 rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2 text-xs font-medium text-amber-800">
          {openBalance > 0 && missingNotes > 0
            ? t(
                "dashboard.closeoutNudgeBoth",
                "Open balance and missing notes — review before closing the day."
              )
            : openBalance > 0
              ? t("dashboard.closeoutNudgeBalance", "Open balance remains — settle invoices before closeout.")
              : t(
                  "dashboard.closeoutNudgeNotes",
                  "Missing clinical notes — document visits before closeout."
                )}
        </p>
      ) : null}
    </Link>
  )
}
