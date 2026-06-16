"use client"

import { cn } from "@/lib/utils"

export type OpsSummaryCell = {
  label: string
  value: string | number
  sub?: string
  emphasis?: "default" | "warning" | "success"
}

type OpsSummaryGridProps = {
  title: string
  subtitle?: string | null
  items: OpsSummaryCell[]
  className?: string
  columnsClassName?: string
}

function SummaryCell({
  label,
  value,
  sub,
  emphasis = "default",
}: OpsSummaryCell) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5",
        emphasis === "warning" && "border-amber-200/90 bg-amber-50/50",
        emphasis === "success" && "border-emerald-200/90 bg-emerald-50/40",
        emphasis === "default" && "border-neutral-200/80 bg-neutral-50/60"
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums text-neutral-950">{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-neutral-500">{sub}</p> : null}
    </div>
  )
}

export function OpsSummaryGrid({
  title,
  subtitle,
  items,
  className,
  columnsClassName = "sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7",
}: OpsSummaryGridProps) {
  if (items.length === 0) return null

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
        {subtitle ? <p className="text-xs text-neutral-500">{subtitle}</p> : null}
      </div>
      <div className={cn("grid gap-2", columnsClassName)}>
        {items.map((item) => (
          <SummaryCell key={item.label} {...item} />
        ))}
      </div>
    </div>
  )
}
