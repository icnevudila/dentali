"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export type HeatmapCell = {
  dow: string
  hour: string
  value: number
}

const DOW_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

type ScheduleHeatmapProps = {
  cells: HeatmapCell[]
  loading?: boolean
  emptyLabel?: string
  className?: string
}

function cellKey(dow: string, hour: string) {
  return `${dow}|${hour}`
}

export function ScheduleHeatmap({
  cells,
  loading,
  emptyLabel = "No data",
  className,
}: ScheduleHeatmapProps) {
  if (loading) {
    return (
      <div className={cn("flex h-40 items-center justify-center text-sm text-neutral-400", className)}>
        Loading…
      </div>
    )
  }

  const valueMap = new Map(cells.map((c) => [cellKey(c.dow, c.hour), c.value]))
  const hours = [...new Set(cells.map((c) => c.hour))].sort()
  const max = Math.max(...cells.map((c) => c.value), 1)
  const hasData = cells.some((c) => c.value > 0)

  if (!hasData || hours.length === 0) {
    return (
      <div className={cn("flex h-40 items-center justify-center text-sm text-neutral-400", className)}>
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <div className="min-w-0 w-max sm:min-w-[320px]">
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `3rem repeat(${hours.length}, minmax(2rem, 1fr))` }}
        >
          <div />
          {hours.map((hour) => (
            <div key={hour} className="text-center text-[10px] font-medium text-neutral-400">
              {hour.replace(":00", "")}
            </div>
          ))}
          {DOW_ORDER.map((dow) => (
            <React.Fragment key={dow}>
              <div className="flex items-center text-[10px] font-medium text-neutral-500">{dow}</div>
              {hours.map((hour) => {
                const value = valueMap.get(cellKey(dow, hour)) ?? 0
                const intensity = value / max
                return (
                  <div
                    key={`${dow}-${hour}`}
                    title={`${dow} ${hour}: ${value}`}
                    className="aspect-square rounded-sm border border-neutral-100"
                    style={{
                      backgroundColor:
                        value === 0
                          ? "rgb(245 245 245)"
                          : `rgba(14, 116, 144, ${0.15 + intensity * 0.85})`,
                    }}
                  />
                )
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
