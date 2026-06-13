"use client"

import * as React from "react"
import Link from "next/link"
import { ClipboardList } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { useLocale } from "@/hooks/use-locale"
import {
  fetchPatientTreatmentTimeline,
  type TreatmentTimelineEntry,
} from "@/lib/clinical/treatment-plan-service"

interface TreatmentPlanTimelinePanelProps {
  patientId: string
  branchId: string
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
  if (status === "approved" || status === "in_progress") return "success"
  if (status === "proposed") return "info"
  if (status === "draft") return "warning"
  return "outline"
}

function itemStatusVariant(status: string): "info" | "success" | "outline" {
  if (status === "in_progress") return "info"
  if (status === "completed") return "success"
  return "outline"
}

export function TreatmentPlanTimelinePanel({ patientId, branchId }: TreatmentPlanTimelinePanelProps) {
  const { t } = useLocale()
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

  const groups = React.useMemo(() => groupByPlan(entries), [entries])

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-neutral-500" />
              {t("chart.treatmentTimeline", "Treatment timeline")}
            </CardTitle>
            <CardDescription>
              {t("chart.treatmentTimelineHint", "Planned procedures linked to this chart.")}
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
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        {!loading && !error && groups.length === 0 && (
          <p className="text-sm text-neutral-500">
            {t("chart.treatmentTimelineEmpty", "No active treatment plan items for this patient.")}
          </p>
        )}

        {!loading && !error && groups.length > 0 && (
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
                          <p className="text-sm font-medium text-neutral-900">{item.description}</p>
                          {item.tooth_number && (
                            <Badge variant="outline" className="text-[10px]">
                              #{item.tooth_number}
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                          <Badge variant={itemStatusVariant(item.item_status)} className="text-[10px]">
                            {item.item_status}
                          </Badge>
                          <span>{item.priority}</span>
                          <span>₱{Number(item.estimated_price).toLocaleString()}</span>
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
