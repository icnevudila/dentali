"use client"

import * as React from "react"
import Link from "next/link"
import { FileText, History, ListOrdered } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { NAV_FORWARD_TRANSITION } from "@/lib/navigation/view-transition"
import { useLocale } from "@/hooks/use-locale"
import {
  fetchPatientTreatmentTimeline,
  type TreatmentPlanSummary,
  type TreatmentTimelineEntry,
} from "@/lib/clinical/treatment-plan-service"
import { cn } from "@/lib/utils"

type PlanFilter = "all" | "original" | "approved" | "in_progress" | "completed" | "cancelled"
type HistoryFilter = "all" | "completed" | "in_progress" | "pending"

function planBadgeVariant(status: string) {
  if (status === "completed") return "success" as const
  if (status === "approved" || status === "accepted") return "info" as const
  if (status === "cancelled" || status === "rejected") return "danger" as const
  if (status === "in_progress") return "warning" as const
  return "outline" as const
}

function isOriginalPlan(status: string) {
  return status === "proposed" || status === "draft"
}

function matchesPlanFilter(status: string, filter: PlanFilter) {
  if (filter === "all") return true
  if (filter === "original") return isOriginalPlan(status)
  if (filter === "approved") return status === "approved" || status === "accepted"
  if (filter === "cancelled") return status === "cancelled" || status === "rejected"
  return status === filter
}

function isHistoryEligible(entry: TreatmentTimelineEntry) {
  const plan = entry.plan_status
  return plan === "approved" || plan === "in_progress" || plan === "completed" || plan === "accepted"
}

function matchesHistoryFilter(entry: TreatmentTimelineEntry, filter: HistoryFilter) {
  if (!isHistoryEligible(entry)) return false
  if (filter === "all") return true
  if (filter === "pending") {
    return entry.item_status !== "completed" && entry.item_status !== "in_progress"
  }
  return entry.item_status === filter
}

function FilterChips<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (next: T) => void
  options: { id: T; label: string }[]
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => (
        <Button
          key={opt.id}
          type="button"
          size="sm"
          variant={value === opt.id ? "default" : "outline"}
          className="h-8"
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  )
}

function formatPhpMajor(amount: number) {
  return `₱${Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function PatientTreatmentPlansTab({
  patientId,
  plans,
}: {
  patientId: string
  plans: TreatmentPlanSummary[]
}) {
  const { t } = useLocale()
  const [filter, setFilter] = React.useState<PlanFilter>("all")

  const filtered = plans.filter((plan) => matchesPlanFilter(plan.status, filter))
  const counts = {
    all: plans.length,
    original: plans.filter((p) => isOriginalPlan(p.status)).length,
    approved: plans.filter((p) => p.status === "approved" || p.status === "accepted").length,
    in_progress: plans.filter((p) => p.status === "in_progress").length,
    completed: plans.filter((p) => p.status === "completed").length,
    cancelled: plans.filter((p) => p.status === "cancelled" || p.status === "rejected").length,
  }

  const options: { id: PlanFilter; label: string }[] = [
    { id: "all", label: `${t("patients.txFilterAll", "All")} (${counts.all})` },
    { id: "original", label: `${t("patients.txFilterOriginal", "Original")} (${counts.original})` },
    { id: "approved", label: `${t("patients.txFilterApproved", "Approved")} (${counts.approved})` },
    { id: "in_progress", label: `${t("patients.txFilterInProgress", "In progress")} (${counts.in_progress})` },
    { id: "completed", label: `${t("patients.txFilterCompleted", "Completed")} (${counts.completed})` },
    { id: "cancelled", label: `${t("patients.txFilterCancelled", "Cancelled")} (${counts.cancelled})` },
  ]

  const statusLabel = (status: string) =>
    isOriginalPlan(status) ? t("patients.txFilterOriginal", "Original") : status.replaceAll("_", " ")

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{t("patients.tabTreatmentPlans", "Treatment Plans")}</CardTitle>
            <CardDescription>
              {t(
                "patients.txPlansHint",
                "Draft and approved plans. Original = not yet approved. Open a plan to edit or approve."
              )}
            </CardDescription>
          </div>
          <Button size="sm" className="h-8 gap-1.5" asChild>
            <Link href={`/patients/${patientId}/treatment-plan`} transitionTypes={NAV_FORWARD_TRANSITION}>
              <FileText className="h-3.5 w-3.5" />
              {t("patients.createTreatmentPlan", "Create treatment plan")}
            </Link>
          </Button>
        </div>
        <FilterChips value={filter} onChange={setFilter} options={options} />
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <EmptyState
            icon={ListOrdered}
            title={t("patients.noTreatmentPlans", "No treatment plans yet.")}
            description={
              plans.length > 0
                ? t("patients.txFilterEmpty", "Nothing in this status. Try All.")
                : t("patients.txPlansEmptyHint", "Create a plan from chart findings, then approve when the patient agrees.")
            }
            action={
              plans.length === 0 ? (
                <Button size="sm" asChild>
                  <Link href={`/patients/${patientId}/treatment-plan`} transitionTypes={NAV_FORWARD_TRANSITION}>
                    {t("patients.createTreatmentPlan", "Create treatment plan")}
                  </Link>
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50">
                <tr>
                  <th className="px-3 py-2 font-medium text-neutral-700">{t("patients.txColPlan", "Plan")}</th>
                  <th className="px-3 py-2 font-medium text-neutral-700">{t("patients.txColDate", "Created")}</th>
                  <th className="px-3 py-2 font-medium text-neutral-700">{t("patients.txColItems", "Items")}</th>
                  <th className="px-3 py-2 font-medium text-neutral-700">{t("patients.txColCost", "Estimate")}</th>
                  <th className="px-3 py-2 font-medium text-neutral-700">{t("patients.txColStatus", "Status")}</th>
                  <th className="px-3 py-2 text-right font-medium text-neutral-700">{t("patients.txColAction", "Action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filtered.map((plan) => (
                  <tr key={plan.id} className="hover:bg-neutral-50">
                    <td className="px-3 py-2.5 font-medium text-neutral-900">{plan.title}</td>
                    <td className="px-3 py-2.5 text-neutral-600">
                      {new Date(plan.created_at).toLocaleDateString("en-PH")}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-neutral-600">{plan.item_count}</td>
                    <td className="px-3 py-2.5 tabular-nums text-neutral-900">
                      {formatPhpMajor(plan.total_estimated)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={planBadgeVariant(plan.status)}>{statusLabel(plan.status)}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button variant="ghost" size="sm" className="h-8" asChild>
                        <Link
                          href={`/patients/${patientId}/treatment-plan?plan=${plan.id}`}
                          transitionTypes={NAV_FORWARD_TRANSITION}
                        >
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
      </CardContent>
    </Card>
  )
}

export function PatientTreatmentHistoryTab({
  patientId,
  branchId,
}: {
  patientId: string
  branchId?: string | null
}) {
  const { t } = useLocale()
  const [filter, setFilter] = React.useState<HistoryFilter>("all")
  const [entries, setEntries] = React.useState<TreatmentTimelineEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchPatientTreatmentTimeline(patientId, branchId).then(({ data, error: err }) => {
      if (cancelled) return
      setEntries(data)
      setError(err)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [patientId, branchId])

  const eligible = entries.filter(isHistoryEligible)
  const filtered = eligible.filter((entry) => matchesHistoryFilter(entry, filter))
  const counts = {
    all: eligible.length,
    completed: eligible.filter((e) => e.item_status === "completed").length,
    in_progress: eligible.filter((e) => e.item_status === "in_progress").length,
    pending: eligible.filter((e) => e.item_status !== "completed" && e.item_status !== "in_progress").length,
  }

  const options: { id: HistoryFilter; label: string }[] = [
    { id: "all", label: `${t("patients.txFilterAll", "All")} (${counts.all})` },
    { id: "completed", label: `${t("patients.txFilterCompleted", "Completed")} (${counts.completed})` },
    { id: "in_progress", label: `${t("patients.txFilterInProgress", "In progress")} (${counts.in_progress})` },
    { id: "pending", label: `${t("patients.txFilterPending", "Pending approved")} (${counts.pending})` },
  ]

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3">
        <div>
          <CardTitle>{t("patients.tabTreatmentHistory", "Treatment History")}</CardTitle>
          <CardDescription>
            {t(
              "patients.txHistoryHint",
              "Approved work only — completed procedures and remaining approved items. Draft plans stay in Treatment Plans."
            )}
          </CardDescription>
        </div>
        <FilterChips value={filter} onChange={setFilter} options={options} />
      </CardHeader>
      <CardContent>
        {loading ? <PageLoadingSkeleton variant="stack" /> : null}
        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
        {!loading && !error && filtered.length === 0 ? (
          <EmptyState
            icon={History}
            title={t("patients.txHistoryEmpty", "No treatment history yet")}
            description={
              eligible.length > 0
                ? t("patients.txFilterEmpty", "Nothing in this status. Try All.")
                : t(
                    "patients.txHistoryEmptyHint",
                    "Approve a treatment plan first. Completed and pending approved items will show here."
                  )
            }
          />
        ) : null}
        {!loading && !error && filtered.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-neutral-200">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50">
                <tr>
                  <th className="px-3 py-2 font-medium text-neutral-700">{t("patients.txColDate", "Created")}</th>
                  <th className="px-3 py-2 font-medium text-neutral-700">{t("patients.txColTooth", "Tooth")}</th>
                  <th className="px-3 py-2 font-medium text-neutral-700">{t("patients.txColProcedure", "Procedure")}</th>
                  <th className="px-3 py-2 font-medium text-neutral-700">{t("patients.txColPlan", "Plan")}</th>
                  <th className="px-3 py-2 font-medium text-neutral-700">{t("patients.txColCost", "Estimate")}</th>
                  <th className="px-3 py-2 font-medium text-neutral-700">{t("patients.txColStatus", "Status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filtered.map((item) => (
                  <tr key={item.item_id} className="hover:bg-neutral-50">
                    <td className="px-3 py-2.5 whitespace-nowrap text-neutral-600">
                      {new Date(item.item_created_at).toLocaleString("en-PH", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Manila",
                      })}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-neutral-800">{item.tooth_number ?? "—"}</td>
                    <td className="px-3 py-2.5 text-neutral-900">{item.description}</td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/patients/${patientId}/treatment-plan?plan=${item.plan_id}`}
                        className={cn("text-primary-700 hover:underline")}
                      >
                        {item.plan_title}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{formatPhpMajor(item.estimated_price)}</td>
                    <td className="px-3 py-2.5">
                      <Badge
                        variant={
                          item.item_status === "completed"
                            ? "success"
                            : item.item_status === "in_progress"
                              ? "warning"
                              : "info"
                        }
                      >
                        {item.item_status === "completed"
                          ? t("patients.txFilterCompleted", "Completed")
                          : item.item_status === "in_progress"
                            ? t("patients.txFilterInProgress", "In progress")
                            : t("patients.txFilterPending", "Pending approved")}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
