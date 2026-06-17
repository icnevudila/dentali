"use client"

import { cn } from "@/lib/utils"
import { HorizontalSnapStrip } from "@/components/layout/HorizontalSnapStrip"
import Link from "next/link"

export type OpsSummaryCell = {
  label: string
  value: string | number
  sub?: string
  emphasis?: "default" | "warning" | "success"
  href?: string
  onClick?: () => void
  active?: boolean
}

type OpsSummaryGridProps = {
  title: string
  subtitle?: string | null
  items: OpsSummaryCell[]
  className?: string
  columnsClassName?: string
  snapOnMobile?: boolean
}

function SummaryCell({
  label,
  value,
  sub,
  emphasis = "default",
  href,
  onClick,
  active = false,
}: OpsSummaryCell) {
  const interactive = Boolean(href || onClick)
  const content = (
    <div
      className={cn(
        "h-full rounded-lg border px-3 py-2.5 transition-colors",
        emphasis === "warning" && "border-amber-200/90 bg-amber-50/50",
        emphasis === "success" && "border-emerald-200/90 bg-emerald-50/40",
        emphasis === "default" && "border-neutral-200/80 bg-neutral-50/60",
        active && "border-primary-300 bg-primary-50/60 ring-1 ring-primary-200/80",
        interactive &&
          !active &&
          "hover:border-primary-200 hover:bg-primary-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30",
        onClick && "cursor-pointer"
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums text-neutral-950">{value}</p>
      {sub ? (
        <p className={cn("mt-0.5 text-[11px]", interactive ? "text-primary-600" : "text-neutral-500")}>
          {sub}
        </p>
      ) : null}
    </div>
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block w-full rounded-lg text-left">
        {content}
      </button>
    )
  }

  if (href) {
    return (
      <Link href={href} className="block rounded-lg">
        {content}
      </Link>
    )
  }

  return content
}

export function OpsSummaryGrid({
  title,
  subtitle,
  items,
  className,
  columnsClassName = "sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7",
  snapOnMobile = true,
}: OpsSummaryGridProps) {
  if (items.length === 0) return null

  const cells = items.map((item) => <SummaryCell key={item.label} {...item} />)

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
        {subtitle ? <p className="text-xs text-neutral-500">{subtitle}</p> : null}
      </div>
      {snapOnMobile ? (
        <HorizontalSnapStrip desktopLayout="grid" desktopCols={3} className={columnsClassName}>
          {cells}
        </HorizontalSnapStrip>
      ) : (
        <div className={cn("grid gap-2", columnsClassName)}>{cells}</div>
      )}
    </div>
  )
}
