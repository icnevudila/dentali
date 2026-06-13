"use client"

import * as React from "react"
import Link from "next/link"
import { Building2 } from "lucide-react"
import { SectionEyebrow } from "@/components/layout/SectionEyebrow"
import { fetchBranchBenchmark } from "@/lib/analytics/analytics-service"
import { useLocale } from "@/hooks/use-locale"
import { cn } from "@/lib/utils"

type BranchRow = {
  label: string
  appointments: number
  collected: number
  noShow: number
  openAr: number
}

type OwnerBranchKpiGridProps = {
  branchCount: number
  activeBranchName?: string
}

export function OwnerBranchKpiGrid({ branchCount, activeBranchName }: OwnerBranchKpiGridProps) {
  const { t } = useLocale()
  const [rows, setRows] = React.useState<BranchRow[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (branchCount < 2) {
      setRows([])
      setLoading(false)
      return
    }

    setLoading(true)
    fetchBranchBenchmark(7).then(({ data }) => {
      setRows(data)
      setLoading(false)
    })
  }, [branchCount])

  if (branchCount < 2) return null

  return (
    <section className="space-y-3">
      <SectionEyebrow icon={Building2}>
        {t("dashboard.ownerBranchGrid", "All branches — 7-day pulse")}
      </SectionEyebrow>

      {loading ? (
        <p className="text-sm text-neutral-500">{t("common.loading", "Loading…")}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-neutral-500 rounded-xl border border-dashed border-neutral-200 px-4 py-6">
          {t("dashboard.ownerBranchEmpty", "No cross-branch activity in the last 7 days.")}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => {
            const isActive = activeBranchName === row.label
            return (
              <div
                key={row.label}
                className={cn(
                  "rounded-xl border bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]",
                  isActive ? "border-primary-300 ring-1 ring-primary-200" : "border-neutral-200/80"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-neutral-900 truncate">{row.label}</p>
                  {isActive ? (
                    <span className="shrink-0 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary-800">
                      {t("dashboard.activeBranch", "Active")}
                    </span>
                  ) : null}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <div>
                    <dt className="text-neutral-500">{t("reports.metricAppointments", "Appointments (7d)")}</dt>
                    <dd className="mt-0.5 text-lg font-bold tabular-nums">{row.appointments}</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">{t("reports.metricCollected", "Collected (7d)")}</dt>
                    <dd className="mt-0.5 text-lg font-bold tabular-nums">
                      ₱{row.collected.toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">{t("reports.metricNoShow", "No-shows (7d)")}</dt>
                    <dd
                      className={cn(
                        "mt-0.5 text-lg font-bold tabular-nums",
                        row.noShow > 0 ? "text-amber-800" : "text-neutral-900"
                      )}
                    >
                      {row.noShow}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">{t("dashboard.openAr", "Open AR")}</dt>
                    <dd
                      className={cn(
                        "mt-0.5 text-lg font-bold tabular-nums",
                        row.openAr > 0 ? "text-amber-800" : "text-neutral-900"
                      )}
                    >
                      ₱{row.openAr.toLocaleString()}
                    </dd>
                  </div>
                </dl>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs text-neutral-500">
        <Link href="/reports" className="text-primary-600 hover:underline">
          {t("dashboard.viewReportsHub", "Open Reports Hub")}
        </Link>{" "}
        {t("dashboard.ownerBranchHint", "for branch benchmarks and finance breakdown.")}
      </p>
    </section>
  )
}
