"use client"

import { cn } from "@/lib/utils"
import type { StatusSlice } from "@/lib/reports/reports-service"
import { formatStatusLabel } from "@/lib/reports/reports-service"

type StatusBreakdownProps = {
  slices: StatusSlice[]
  emptyLabel?: string
  className?: string
}

export function StatusBreakdown({ slices, emptyLabel = "No appointments", className }: StatusBreakdownProps) {
  const total = slices.reduce((sum, s) => sum + s.count, 0)

  if (total === 0) {
    return <p className={cn("text-sm text-neutral-400", className)}>{emptyLabel}</p>
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex h-3 overflow-hidden rounded-full bg-neutral-100">
        {slices.map((slice) => (
          <div
            key={slice.status}
            className={cn("h-full transition-all", slice.color)}
            style={{ width: `${(slice.count / total) * 100}%` }}
            title={`${formatStatusLabel(slice.status)}: ${slice.count}`}
          />
        ))}
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {slices.map((slice) => (
          <li key={slice.status} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", slice.color)} aria-hidden />
              <span className="truncate text-neutral-600">{formatStatusLabel(slice.status)}</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-neutral-900">
              {slice.count}
              <span className="ml-1 text-xs font-normal text-neutral-400">
                ({Math.round((slice.count / total) * 100)}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
