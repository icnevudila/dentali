"use client"

import { cn } from "@/lib/utils"
import type { DayBucket } from "@/lib/reports/date-buckets"

type MiniBarChartProps = {
  data: DayBucket[]
  valueFormatter?: (value: number) => string
  barClassName?: string
  emptyLabel?: string
  className?: string
}

export function MiniBarChart({
  data,
  valueFormatter = (v) => String(v),
  barClassName = "bg-primary-500",
  emptyLabel = "No data",
  className,
}: MiniBarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1)
  const hasData = data.some((d) => d.value > 0)

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className={cn(
          "flex items-end gap-0.5 sm:gap-1.5",
          data.length > 14 ? "h-32 overflow-x-auto pb-1" : "h-36 gap-1.5 sm:gap-2"
        )}
        role="img"
        aria-label={hasData ? `Chart with ${data.length} days` : emptyLabel}
      >
        {data.map((point) => {
          const heightPct = hasData ? Math.max((point.value / max) * 100, point.value > 0 ? 8 : 0) : 0
          const dense = data.length > 14
          return (
            <div
              key={point.date}
              className={cn(
                "flex min-w-0 flex-col items-center gap-1",
                dense ? "w-7 shrink-0 sm:w-8" : "flex-1 gap-1.5"
              )}
            >
              {!dense && point.value > 0 ? (
                <span className="text-[10px] font-medium tabular-nums text-neutral-500 sm:text-xs">
                  {valueFormatter(point.value)}
                </span>
              ) : null}
              <div className={cn("flex w-full items-end", dense ? "h-24" : "flex-1")}>
                <div
                  className={cn(
                    "w-full rounded-t transition-all duration-500",
                    dense ? "rounded-t-sm" : "rounded-t-md",
                    barClassName,
                    point.value === 0 && "bg-neutral-100"
                  )}
                  style={{ height: `${heightPct}%` }}
                  title={`${point.label}: ${valueFormatter(point.value)}`}
                />
              </div>
              <span
                className={cn(
                  "truncate text-center text-neutral-500",
                  dense ? "text-[9px] leading-tight" : "text-[10px] sm:text-xs"
                )}
              >
                {point.label}
              </span>
            </div>
          )
        })}
      </div>
      {!hasData ? <p className="text-center text-xs text-neutral-400">{emptyLabel}</p> : null}
    </div>
  )
}
