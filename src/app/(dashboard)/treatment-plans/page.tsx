"use client"

import * as React from "react"
import Link from "next/link"
import { ListOrdered, RefreshCw } from "lucide-react"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { DirectionalTransition } from "@/components/layout/DirectionalTransition"
import { PageHeader } from "@/components/layout/PageHeader"
import { SectionEyebrow } from "@/components/layout/SectionEyebrow"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { NAV_FORWARD_TRANSITION } from "@/lib/navigation/view-transition"
import {
  fetchBranchTreatmentPlans,
  type BranchTreatmentPlanRow,
  type BranchTreatmentPlanStatusGroup,
} from "@/lib/clinical/treatment-plan-service"

const FILTERS: BranchTreatmentPlanStatusGroup[] = [
  "all",
  "unapproved",
  "approved",
  "ongoing",
  "completed",
]

function planHref(row: BranchTreatmentPlanRow) {
  return `/patients/${row.patient_id}/treatment-plan?plan=${row.plan_id}`
}

function statusBadge(row: BranchTreatmentPlanRow) {
  if (row.status_group === "completed") return "success" as const
  if (row.status_group === "approved") return "info" as const
  if (row.status_group === "ongoing") return "warning" as const
  return "outline" as const
}

export default function TreatmentPlansWorklistPage() {
  const { t } = useLocale()
  const { activeBranch, hasActiveBranch } = useBranch()
  const [rows, setRows] = React.useState<BranchTreatmentPlanRow[]>([])
  const [filter, setFilter] = React.useState<BranchTreatmentPlanStatusGroup>("all")
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    if (!activeBranch?.id) {
      setRows([])
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: loadError } = await fetchBranchTreatmentPlans(activeBranch.id, {
      limit: 200,
      statusGroup: "all",
    })
    setRows(data)
    setError(loadError)
    setLoading(false)
  }, [activeBranch?.id])

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(id)
  }, [load])

  const counts = React.useMemo(() => {
    const next = { all: rows.length, unapproved: 0, approved: 0, ongoing: 0, completed: 0 }
    for (const row of rows) {
      next[row.status_group] += 1
    }
    return next
  }, [rows])

  const visible = filter === "all" ? rows : rows.filter((row) => row.status_group === filter)

  const filterLabel = (id: BranchTreatmentPlanStatusGroup) => {
    const labels: Record<BranchTreatmentPlanStatusGroup, string> = {
      all: t("txHub.filterAll", "All"),
      unapproved: t("txHub.filterUnapproved", "Original"),
      approved: t("txHub.filterApproved", "Approved"),
      ongoing: t("txHub.filterOngoing", "Ongoing"),
      completed: t("txHub.filterCompleted", "Completed / history"),
    }
    return labels[id]
  }

  return (
    <PermissionGate permission={PERMISSIONS.DENTAL_CHART_READ}>
      <DirectionalTransition className="mx-auto flex max-w-6xl flex-col gap-4 pb-10">
        <SectionEyebrow icon={ListOrdered}>Clinical · Treatment plans</SectionEyebrow>
        <PageHeader
          title={t("txHub.title", "Treatment plans")}
          description={t(
            "txHub.subtitle",
            "Branch case list. Open a row to edit that plan only — history stays on the patient file."
          )}
          actions={
            <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => void load()}>
              <RefreshCw className="h-3.5 w-3.5" />
              {t("common.refresh", "Refresh")}
            </Button>
          }
        />

        <div className="flex flex-wrap gap-1">
          {FILTERS.map((id) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={filter === id ? "default" : "outline"}
              className="h-8"
              onClick={() => setFilter(id)}
            >
              {filterLabel(id)} ({counts[id]})
            </Button>
          ))}
        </div>

        {!hasActiveBranch ? (
          <p className="text-sm text-neutral-600">{t("common.selectBranch", "Select a branch")}</p>
        ) : loading ? (
          <PageLoadingSkeleton variant="stack" />
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <p className="font-semibold">{t("txHub.loadError", "Could not load treatment plans")}</p>
            <p className="mt-1 font-mono text-xs">{error}</p>
            <Button size="sm" className="mt-3 h-8" variant="outline" onClick={() => void load()}>
              {t("common.retry", "Retry")}
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={ListOrdered}
            title={t("txHub.empty", "No cases in this filter")}
            description={t(
              "txHub.emptyHint",
              "Create a plan from the patient file. Original = waiting for accept. Approved = can treat."
            )}
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50">
                <tr>
                  <th className="px-3 py-2 font-medium text-neutral-700">{t("txHub.colPatient", "Patient")}</th>
                  <th className="px-3 py-2 font-medium text-neutral-700">{t("txHub.colPlan", "Plan")}</th>
                  <th className="px-3 py-2 font-medium text-neutral-700">{t("txHub.colProgress", "Progress")}</th>
                  <th className="px-3 py-2 font-medium text-neutral-700">{t("txHub.colEstimate", "Estimate")}</th>
                  <th className="px-3 py-2 font-medium text-neutral-700">{t("txHub.colStatus", "Status")}</th>
                  <th className="px-3 py-2 text-right font-medium text-neutral-700">{t("patients.txColAction", "Action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {visible.map((row) => (
                  <tr key={row.plan_id} className="hover:bg-neutral-50">
                    <td className="px-3 py-2.5 font-medium text-neutral-900">
                      {row.patient_first_name} {row.patient_last_name}
                    </td>
                    <td className="px-3 py-2.5 text-neutral-800">{row.title}</td>
                    <td className="px-3 py-2.5 tabular-nums text-neutral-600">
                      {row.completed_item_count}/{row.item_count}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      ₱{Number(row.total_estimated).toLocaleString("en-PH")}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={statusBadge(row)}>{filterLabel(row.status_group)}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button size="sm" variant="ghost" className="h-8" asChild>
                        <Link href={planHref(row)} transitionTypes={NAV_FORWARD_TRANSITION}>
                          {t("patients.txView", "View")}
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DirectionalTransition>
    </PermissionGate>
  )
}
