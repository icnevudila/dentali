"use client"

import * as React from "react"
import Link from "next/link"
import { ClipboardList, RefreshCw, Users } from "lucide-react"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { DirectionalTransition } from "@/components/layout/DirectionalTransition"
import {
  fetchBranchTreatmentPlans,
  treatmentPlanPatientName,
  type BranchTreatmentPlanList,
  type TreatmentPlanStatusGroup,
} from "@/lib/clinical/branch-treatment-plans-service"

const FILTERS: { id: TreatmentPlanStatusGroup; labelKey: string; fallback: string }[] = [
  { id: "all", labelKey: "treatmentPlans.filterAll", fallback: "All" },
  { id: "unapproved", labelKey: "treatmentPlans.filterUnapproved", fallback: "Unapproved" },
  { id: "approved", labelKey: "treatmentPlans.filterApproved", fallback: "Approved" },
  { id: "ongoing", labelKey: "treatmentPlans.filterOngoing", fallback: "Ongoing" },
  { id: "history", labelKey: "treatmentPlans.filterHistory", fallback: "Completed / history" },
]

function formatClinicDateTime(iso: string, locale: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleString(locale === "fil" ? "fil-PH" : locale === "tr" ? "tr-TR" : "en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function planStatusLabel(status: string, t: (key: string, fallback: string) => string) {
  if (status === "draft" || status === "proposed") {
    return t("treatmentPlans.statusProposed", "Waiting for accept")
  }
  if (status === "approved") return t("treatmentPlans.statusApproved", "Accepted")
  if (status === "in_progress") return t("treatmentPlans.statusOngoing", "Treatment underway")
  if (status === "completed") return t("treatmentPlans.statusCompleted", "Finished")
  if (status === "cancelled") return t("treatmentPlans.statusCancelled", "Cancelled")
  return status
}

function planStatusVariant(status: string): "warning" | "success" | "info" | "outline" {
  if (status === "draft" || status === "proposed") return "warning"
  if (status === "approved" || status === "completed") return "success"
  if (status === "in_progress") return "info"
  return "outline"
}

export default function TreatmentPlansPage() {
  const { t, locale } = useLocale()
  const { activeBranch } = useBranch()
  const [group, setGroup] = React.useState<TreatmentPlanStatusGroup>("unapproved")
  const [list, setList] = React.useState<BranchTreatmentPlanList | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [query, setQuery] = React.useState("")

  const load = React.useCallback(() => {
    if (!activeBranch) {
      setList(null)
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    void fetchBranchTreatmentPlans(activeBranch.id, group).then(({ data, error: err }) => {
      setList(data)
      setError(err)
      setLoading(false)
    })
  }, [activeBranch, group])

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      load()
    }, 0)
    return () => window.clearTimeout(id)
  }, [load])

  const counts = list?.counts
  const rows = React.useMemo(() => {
    const all = list?.rows ?? []
    const q = query.trim().toLowerCase()
    if (!q) return all
    return all.filter((row) => treatmentPlanPatientName(row).toLowerCase().includes(q))
  }, [list, query])

  return (
    <PermissionGate permission={PERMISSIONS.PATIENTS_READ}>
      <DirectionalTransition>
        <ModulePageShell
          eyebrow={t("treatmentPlans.eyebrow", "Clinical")}
          icon={ClipboardList}
          title={t("nav.treatmentPlans", "Treatment plans")}
          description={t(
            "treatmentPlans.description",
            "Branch case list: waiting for accept, accepted, treatment underway, and finished. Open a row to see that patient’s plan and treatment history."
          )}
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => load()}
              disabled={!activeBranch || loading}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              {t("common.refresh", "Refresh")}
            </Button>
          }
          metrics={[
            {
              label: t("treatmentPlans.filterAll", "All"),
              value: counts?.all ?? "—",
              onClick: () => setGroup("all"),
              active: group === "all",
            },
            {
              label: t("treatmentPlans.filterUnapproved", "Unapproved"),
              value: counts?.unapproved ?? "—",
              hint: t("treatmentPlans.hintUnapproved", "Waiting for patient accept"),
              onClick: () => setGroup("unapproved"),
              active: group === "unapproved",
              variant: "warning",
            },
            {
              label: t("treatmentPlans.filterApproved", "Approved"),
              value: counts?.approved ?? "—",
              hint: t("treatmentPlans.hintApproved", "Accepted — can treat / invoice"),
              onClick: () => setGroup("approved"),
              active: group === "approved",
              variant: "success",
            },
            {
              label: t("treatmentPlans.filterOngoing", "Ongoing"),
              value: counts?.ongoing ?? "—",
              hint: t("treatmentPlans.hintOngoing", "Treatment underway"),
              onClick: () => setGroup("ongoing"),
              active: group === "ongoing",
            },
            {
              label: t("treatmentPlans.filterHistory", "Completed / history"),
              value: counts?.history ?? "—",
              hint: t("treatmentPlans.hintHistory", "Finished or cancelled"),
              onClick: () => setGroup("history"),
              active: group === "history",
            },
          ]}
        >
          {!activeBranch ? (
            <p className="text-sm text-neutral-500">
              {t("dashboard.selectBranch", "Select a branch to view stats")}
            </p>
          ) : loading ? (
            <PageLoadingSkeleton variant="listRows" />
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50/80 p-4">
              <p className="text-sm font-medium text-red-800">
                {t("treatmentPlans.errorTitle", "Could not load treatment plans")}
              </p>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => load()}>
                {t("common.retry", "Retry")}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setGroup(filter.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      group === filter.id
                        ? "border-primary-300 bg-primary-50 text-primary-800"
                        : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                    }`}
                  >
                    {t(filter.labelKey, filter.fallback)}
                  </button>
                ))}
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("treatmentPlans.searchPlaceholder", "Search patient name")}
                  className="ml-auto h-9 max-w-xs"
                />
              </div>

              {rows.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title={t("treatmentPlans.emptyTitle", "No treatment plans in this list")}
                  description={t(
                    "treatmentPlans.emptyDescription",
                    "Plans are created on the patient record. This worklist does not invent finished treatments — completed rows appear after a dentist marks procedures done."
                  )}
                  action={
                    <Button asChild size="sm" className="gap-1.5">
                      <Link href="/patients">
                        <Users className="h-4 w-4" aria-hidden />
                        {t("treatmentPlans.openPatients", "Open patients")}
                      </Link>
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
                  {rows.map((row) => {
                    const name = treatmentPlanPatientName(row)
                    const href = `/patients/${row.patient_id}/treatment-plan?plan=${row.plan_id}`
                    const historyHref = `/patients/${row.patient_id}/treatment-plan?plan=${row.plan_id}#treatment-history`
                    return (
                      <li key={row.plan_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-neutral-900">{name}</p>
                          <p className="truncate text-sm text-neutral-600">{row.title}</p>
                          <p className="mt-1 text-xs text-neutral-500">
                            {t("treatmentPlans.progress", "{done}/{total} done")
                              .replace("{done}", String(row.items_completed))
                              .replace("{total}", String(row.item_count))}
                            {" · "}
                            ₱{Number(row.total_estimated || 0).toLocaleString("en-PH")}
                            {" · "}
                            {formatClinicDateTime(row.created_at, locale)}
                          </p>
                        </div>
                        <Badge variant={planStatusVariant(row.status)}>
                          {planStatusLabel(row.status, t)}
                        </Badge>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" asChild>
                            <Link href={href}>{t("treatmentPlans.openPlan", "Open plan")}</Link>
                          </Button>
                          <Button size="sm" variant="outline" asChild>
                            <Link href={historyHref}>
                              {t("treatmentPlans.openHistory", "Patient history")}
                            </Link>
                          </Button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </ModulePageShell>
      </DirectionalTransition>
    </PermissionGate>
  )
}
