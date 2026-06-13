"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { fetchPatientTreatmentTimeline } from "@/lib/clinical/treatment-plan-service"
import { cn } from "@/lib/utils"

type TreatmentPlanProgressBarProps = {
  patientId: string
  branchId?: string | null
  className?: string
}

export function TreatmentPlanProgressBar({
  patientId,
  branchId,
  className,
}: TreatmentPlanProgressBarProps) {
  const [loading, setLoading] = useState(true)
  const [planTitle, setPlanTitle] = useState<string | null>(null)
  const [planId, setPlanId] = useState<string | null>(null)
  const [completed, setCompleted] = useState(0)
  const [total, setTotal] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await fetchPatientTreatmentTimeline(patientId, branchId)
    const activePlanId = data.find(
      (e) => e.plan_status !== "completed" && e.plan_status !== "cancelled"
    )?.plan_id

    if (!activePlanId) {
      setPlanTitle(null)
      setPlanId(null)
      setCompleted(0)
      setTotal(0)
      setLoading(false)
      return
    }

    const planItems = data.filter((e) => e.plan_id === activePlanId)
    const done = planItems.filter((e) => e.item_status === "completed").length
    const first = planItems[0]

    setPlanId(activePlanId)
    setPlanTitle(first?.plan_title ?? "Treatment plan")
    setCompleted(done)
    setTotal(planItems.length)
    setLoading(false)
  }, [patientId, branchId])

  useEffect(() => {
    void load()
  }, [load])

  const percent = useMemo(() => {
    if (total <= 0) return 0
    return Math.round((completed / total) * 100)
  }, [completed, total])

  if (loading) {
    return (
      <div className={cn("rounded-lg border border-neutral-200 bg-neutral-50/50 px-3 py-2 text-xs text-neutral-400", className)}>
        Loading plan progress…
      </div>
    )
  }

  if (!planId || total === 0) return null

  return (
    <div className={cn("rounded-lg border border-neutral-200 bg-white px-3 py-2.5", className)}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <Link
          href={`/patients/${patientId}/treatment-plan?plan=${planId}`}
          className="font-medium text-primary-600 hover:underline truncate"
        >
          {planTitle}
        </Link>
        <span className="shrink-0 tabular-nums text-neutral-500">
          {completed}/{total} · {percent}%
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
        <div
          className="h-full rounded-full bg-primary-500 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
