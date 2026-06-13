"use client"

import * as React from "react"
import { ModuleAnalyticsPanel } from "@/components/analytics/ModuleAnalyticsPanel"
import {
  buildOrthoBalanceTimeline,
  buildOrthoPaymentTimeline,
  buildOrthoVisitTimeline,
} from "@/lib/clinical/ortho-timeline"
import type { OrthoAdjustment } from "@/lib/clinical/ortho-service"
import { useLocale } from "@/hooks/use-locale"

type OrthoCaseTimelinePanelProps = {
  contractAmount: number
  adjustments: OrthoAdjustment[]
  compact?: boolean
}

export function OrthoCaseTimelinePanel({
  contractAmount,
  adjustments,
  compact = false,
}: OrthoCaseTimelinePanelProps) {
  const { t } = useLocale()

  const balanceTimeline = React.useMemo(
    () => buildOrthoBalanceTimeline(contractAmount, adjustments),
    [contractAmount, adjustments]
  )
  const visitTimeline = React.useMemo(
    () => buildOrthoVisitTimeline(adjustments),
    [adjustments]
  )
  const paymentTimeline = React.useMemo(
    () => buildOrthoPaymentTimeline(adjustments),
    [adjustments]
  )

  if (adjustments.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        {t("ortho.timelineEmpty", "Log visits to see balance and adjustment charts.")}
      </p>
    )
  }

  const peso = (v: number) => `₱${v.toLocaleString()}`

  if (compact) {
    return (
      <ModuleAnalyticsPanel
        title={t("ortho.balanceTimeline", "Balance over visits")}
        variant="area"
        data={balanceTimeline}
        height={140}
        valueFormatter={peso}
        emptyLabel={t("ortho.timelineEmpty", "No visits yet")}
      />
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ModuleAnalyticsPanel
        title={t("ortho.balanceTimeline", "Balance over visits")}
        subtitle={t("ortho.balanceTimelineHint", "Remaining contract balance after each visit")}
        variant="area"
        data={balanceTimeline}
        height={200}
        valueFormatter={peso}
      />
      <ModuleAnalyticsPanel
        title={t("ortho.adjustmentTimeline", "Adjustment timeline")}
        subtitle={t("ortho.visitTimelineHint", "Visits and payments per session")}
        variant="bar"
        data={paymentTimeline.some((p) => p.value > 0) ? paymentTimeline : visitTimeline}
        height={200}
        valueFormatter={
          paymentTimeline.some((p) => p.value > 0)
            ? peso
            : undefined
        }
      />
    </div>
  )
}
