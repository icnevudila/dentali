"use client"

import {
  TrendArea,
  TrendLine,
  CompareBar,
  StatusFunnel,
  DistributionPie,
  type ChartPoint,
  type FunnelStep,
} from "@/components/charts/ChartKit"
import { cn } from "@/lib/utils"

type ModuleAnalyticsPanelProps = {
  title: string
  subtitle?: string
  variant?: "line" | "area" | "bar" | "funnel" | "pie"
  data?: ChartPoint[]
  funnelSteps?: FunnelStep[]
  loading?: boolean
  emptyLabel?: string
  valueFormatter?: (v: number) => string
  className?: string
  height?: number
}

export function ModuleAnalyticsPanel({
  title,
  subtitle,
  variant = "line",
  data = [],
  funnelSteps = [],
  loading,
  emptyLabel = "No data yet",
  valueFormatter,
  className,
  height = 200,
}: ModuleAnalyticsPanelProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-neutral-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]",
        className
      )}
    >
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p> : null}
      </div>
      {loading ? (
        <div className="flex items-center justify-center text-sm text-neutral-400" style={{ height }}>
          Loading…
        </div>
      ) : variant === "funnel" ? (
        <StatusFunnel steps={funnelSteps} emptyLabel={emptyLabel} />
      ) : variant === "pie" ? (
        <DistributionPie data={data} height={height} emptyLabel={emptyLabel} valueFormatter={valueFormatter} />
      ) : variant === "area" ? (
        <TrendArea data={data} height={height} emptyLabel={emptyLabel} valueFormatter={valueFormatter} />
      ) : variant === "bar" ? (
        <CompareBar data={data} height={height} emptyLabel={emptyLabel} valueFormatter={valueFormatter} />
      ) : (
        <TrendLine data={data} height={height} emptyLabel={emptyLabel} valueFormatter={valueFormatter} />
      )}
    </div>
  )
}
