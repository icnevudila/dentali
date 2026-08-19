"use client"

import * as React from "react"
import Link from "next/link"
import { ClipboardList } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BulletTextList } from "@/components/ui/BulletTextList"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { useLocale } from "@/hooks/use-locale"
import {
  fetchPatientTreatmentTimeline,
  type TreatmentTimelineEntry,
} from "@/lib/clinical/treatment-plan-service"

interface TreatmentPlanTimelinePanelProps {
  patientId: string
  branchId: string
  /** Patient lifetime history (includes completed). Default filters to open items for chart. */
  variant?: "active" | "history"
}

function groupByPlan(entries: TreatmentTimelineEntry[]) {
  const map = new Map<string, { plan: TreatmentTimelineEntry; items: TreatmentTimelineEntry[] }>()
  for (const entry of entries) {
    const existing = map.get(entry.plan_id)
    if (existing) {
      existing.items.push(entry)
    } else {
      map.set(entry.plan_id, { plan: entry, items: [entry] })
    }
  }
  return [...map.values()]
}

function planStatusVariant(status: string): "info" | "success" | "warning" | "outline" {
  if (status === "approved" || status === "in_progress" || status === "completed") return "success"
  if (status === "proposed") return "info"
  if (status === "draft") return "warning"
  return "outline"
}

function normalizeClinicalStatus(status: string | null | undefined): string {
  const value = (status || "").toLowerCase().trim()
  if (value === "done" || value === "finished" || value === "complete") return "completed"
  if (value === "started") return "in_progress"
  return value
}

function itemStatusVariant(status: string): "info" | "success" | "outline" | "danger" {
  const normalized = normalizeClinicalStatus(status)
  if (normalized === "in_progress") return "info"
  if (normalized === "completed") return "success"
  if (normalized === "cancelled") return "danger"
  return "outline"
}

function eventDate(entry: TreatmentTimelineEntry) {
  return entry.item_status_changed_at || entry.item_created_at
}

export function TreatmentPlanTimelinePanel({
  patientId,
  branchId,
  variant = "active",
}: TreatmentPlanTimelinePanelProps) {
  const { t, locale } = useLocale()
  const [entries, setEntries] = React.useState<TreatmentTimelineEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setLoading(true)
    fetchPatientTreatmentTimeline(patientId, branchId).then(({ data, error: err }) => {
      setEntries(data)
      setError(err)
      setLoading(false)
    })
  }, [patientId, branchId])

  const visible = React.useMemo(() => {
    if (variant === "history") {
      const rank = (status: string) => {
        const normalized = normalizeClinicalStatus(status)
        if (normalized === "completed") return 0
        if (normalized === "cancelled") return 1
        if (normalized === "in_progress") return 2
        return 3
      }
      return [...entries].sort((a, b) => {
        const byStatus = rank(a.item_status) - rank(b.item_status)
        if (byStatus !== 0) return byStatus
        return eventDate(b).localeCompare(eventDate(a))
      })
    }
    return entries.filter((e) => {
      const plan = normalizeClinicalStatus(e.plan_status)
      const item = normalizeClinicalStatus(e.item_status)
      return !["cancelled", "completed"].includes(plan) && !["cancelled", "completed"].includes(item)
    })
  }, [entries, variant])

  const groups = React.useMemo(() => groupByPlan(visible), [visible])
  const isHistory = variant === "history"

  const formatWhen = (iso: string) => {
    const parsed = new Date(iso)
    if (Number.isNaN(parsed.getTime())) return iso
    return parsed.toLocaleString(locale === "fil" ? "fil-PH" : locale === "tr" ? "tr-TR" : "en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <Card className="h-full" id={isHistory ? "treatment-history" : undefined}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-neutral-500" />
              {isHistory
                ? t("treatmentPlan.historyTitle", "Treatment history")
                : t("chart.treatmentTimeline", "Treatment timeline")}
            </CardTitle>
            <CardDescription>
              {isHistory
                ? t(
                    "treatmentPlan.historyHint",
                    "This patient’s procedures over time — tooth, status, and PHP. Completed rows appear only after they are marked done."
                  )
                : t("chart.treatmentTimelineHint", "Planned procedures linked to this chart.")}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/patients/${patientId}/treatment-plan`}>
              {t("chart.openTreatmentPlan", "Open plans")}
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && <PageLoadingSkeleton variant="stack" />}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-sm font-medium text-red-800">
              {t("treatmentPlan.historyError", "Could not load treatment history")}
            </p>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        )}

        {!loading && !error && visible.length === 0 && (
          isHistory ? (
            <EmptyState
              icon={ClipboardList}
              className="py-8"
              title={t("treatmentPlan.historyEmptyTitle", "No treatment history yet")}
              description={t(
                "treatmentPlan.historyEmpty",
                "History lists this patient’s planned and completed procedures. Nothing is marked finished until a dentist updates the procedure status."
              )}
            />
          ) : (
            <p className="text-sm text-neutral-500">
              {t("chart.treatmentTimelineEmpty", "No active treatment plan items for this patient.")}
            </p>
          )
        )}

        {!loading && !error && isHistory && visible.length > 0 && (
          <ol className="space-y-2">
            {visible.map((item) => (
              <li
                key={item.item_id}
                className="rounded-lg border border-neutral-100 bg-neutral-50/80 px-3 py-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-neutral-500">{formatWhen(eventDate(item))}</p>
                  <Badge variant={itemStatusVariant(item.item_status)} className="text-[10px]">
                    {normalizeClinicalStatus(item.item_status) === "completed"
                      ? t("treatmentPlan.itemCompleted", "Completed")
                      : normalizeClinicalStatus(item.item_status) === "in_progress"
                        ? t("treatmentPlan.itemInProgress", "In progress")
                        : normalizeClinicalStatus(item.item_status) === "cancelled"
                          ? t("treatmentPlan.itemCancelled", "Cancelled")
                          : t("treatmentPlan.itemPlanned", "Planned")}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {item.tooth_number ? (
                    <Badge variant="outline" className="text-[10px]">
                      {t("treatmentPlan.toothNumber", "Tooth #")} {item.tooth_number}
                    </Badge>
                  ) : null}
                  <div className="text-sm font-medium text-neutral-900 min-w-0">
                    <BulletTextList text={item.description} />
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                  <span>₱{Number(item.estimated_price).toLocaleString("en-PH")}</span>
                  <Link
                    href={`/patients/${patientId}/treatment-plan?plan=${item.plan_id}`}
                    className="text-primary-700 hover:underline"
                  >
                    {item.plan_title}
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        )}

        {!loading && !error && !isHistory && groups.length > 0 && (
          <div className="space-y-5">
            {groups.map(({ plan, items }) => (
              <div key={plan.plan_id}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <Link
                    href={`/patients/${patientId}/treatment-plan?plan=${plan.plan_id}`}
                    className="text-sm font-semibold text-primary-700 hover:underline truncate"
                  >
                    {plan.plan_title}
                  </Link>
                  <Badge variant={planStatusVariant(plan.plan_status)}>{plan.plan_status}</Badge>
                </div>
                <ol className="relative border-l border-neutral-200 ml-2 space-y-3">
                  {items.map((item) => (
                    <li key={item.item_id} className="ml-4">
                      <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-primary-400" />
                      <div className="rounded-md border border-neutral-100 bg-neutral-50/80 px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <div className="text-sm font-medium text-neutral-900 min-w-0">
                            <BulletTextList text={item.description} />
                          </div>
                          {item.tooth_number && (
                            <Badge variant="outline" className="text-[10px]">
                              #{item.tooth_number}
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                          <Badge variant={itemStatusVariant(item.item_status)} className="text-[10px]">
                            {normalizeClinicalStatus(item.item_status)}
                          </Badge>
                          <span>{item.priority}</span>
                          <span>₱{Number(item.estimated_price).toLocaleString("en-PH")}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
