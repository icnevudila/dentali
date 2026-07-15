"use client"

import * as React from "react"
import Link from "next/link"
import { Star, RefreshCw, Download, MapPin, ArrowLeft } from "lucide-react"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SatisfactionAnalyticsPanel } from "@/components/analytics/SatisfactionAnalyticsPanel"
import {
  downloadSatisfactionCsv,
  fetchSatisfactionSummary,
  type SatisfactionSummary,
} from "@/lib/reports/satisfaction-service"

const PERIOD_DAYS = [7, 30, 90] as const
type PeriodDays = (typeof PERIOD_DAYS)[number]

const ACCESS = [
  PERMISSIONS.AUDIT_READ,
  PERMISSIONS.BILLING_READ,
  PERMISSIONS.COMPLIANCE_READ,
] as const

export default function SatisfactionReportPage() {
  const { activeBranch } = useBranch()
  const { t, locale } = useLocale()
  const [periodDays, setPeriodDays] = React.useState<PeriodDays>(30)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [summary, setSummary] = React.useState<SatisfactionSummary | null>(null)

  const load = React.useCallback(async () => {
    if (!activeBranch?.id) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await fetchSatisfactionSummary(activeBranch.id, periodDays)
    setSummary(data)
    setError(err)
    setLoading(false)
  }, [activeBranch?.id, periodDays])

  React.useEffect(() => {
    void load()
  }, [load])

  if (!activeBranch) {
    return (
      <PermissionGate anyOf={[...ACCESS]}>
        <ModulePageShell
          icon={Star}
          eyebrow={t("reports.devicesEyebrow", "Patient-facing")}
          title={t("satisfaction.title", "Check-in satisfaction")}
          description={t(
            "satisfaction.subtitle",
            "Kiosk star ratings and optional comments after check-in."
          )}
        >
          <p className="text-sm text-neutral-500">
            {t("common.selectBranch", "Select a branch to continue.")}
          </p>
        </ModulePageShell>
      </PermissionGate>
    )
  }

  return (
    <PermissionGate anyOf={[...ACCESS]}>
      <ModulePageShell
        icon={Star}
        eyebrow={t("reports.devicesEyebrow", "Patient-facing")}
        title={t("satisfaction.title", "Check-in satisfaction")}
        description={t(
          "satisfaction.subtitle",
          "Kiosk star ratings and optional comments after check-in. No patient names are shown."
        )}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/reports?focus=devices#devices">
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                {t("reports.backToHub", "Reports hub")}
              </Link>
            </Button>
            <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-0.5">
              {PERIOD_DAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setPeriodDays(d)}
                  className={
                    periodDays === d
                      ? "rounded-md bg-primary-600 px-2.5 py-1 text-xs font-semibold text-white"
                      : "rounded-md px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
                  }
                >
                  {d}d
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              {t("common.refresh", "Refresh")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!summary?.recent.length}
              onClick={() =>
                summary &&
                downloadSatisfactionCsv(
                  summary.recent,
                  `satisfaction-${activeBranch.id.slice(0, 8)}-${periodDays}d.csv`
                )
              }
            >
              <Download className="mr-1 h-3.5 w-3.5" />
              {t("common.exportCsv", "Export CSV")}
            </Button>
          </div>
        }
      >
        <div className="mb-4 flex items-center gap-2 text-sm text-neutral-500">
          <MapPin className="h-4 w-4" />
          {activeBranch.name}
        </div>

        {loading && !summary ? (
          <PageLoadingSkeleton />
        ) : (
          <div className="space-y-6">
            <SatisfactionAnalyticsPanel
              branchId={activeBranch.id}
              periodDays={periodDays}
              showLink={false}
              summary={summary ?? undefined}
              loading={loading}
              error={error}
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t("satisfaction.recentTitle", "Recent responses")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!summary?.recent.length ? (
                  <p className="py-8 text-center text-sm text-neutral-500">
                    {t(
                      "satisfaction.empty",
                      "No satisfaction responses in this period yet. They appear after kiosk check-in surveys."
                    )}
                  </p>
                ) : (
                  <ul className="divide-y divide-neutral-100">
                    {summary.recent.map((row) => (
                      <li
                        key={row.id}
                        className="flex flex-wrap items-start justify-between gap-3 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="tabular-nums">
                              {row.rating}★
                            </Badge>
                            <span className="text-xs capitalize text-neutral-400">{row.source}</span>
                          </div>
                          {row.feedback_text ? (
                            <p className="mt-1 text-sm text-neutral-700">{row.feedback_text}</p>
                          ) : (
                            <p className="mt-1 text-sm italic text-neutral-400">
                              {t("satisfaction.noComment", "No comment")}
                            </p>
                          )}
                        </div>
                        <p className="shrink-0 text-xs text-neutral-400">
                          {new Date(row.created_at).toLocaleString(locale === "tr" ? "tr-TR" : "en-PH", {
                            dateStyle: "short",
                            timeStyle: "short",
                            timeZone: "Asia/Manila",
                          })}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </ModulePageShell>
    </PermissionGate>
  )
}
