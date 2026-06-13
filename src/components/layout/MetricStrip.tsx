import type { CSSProperties } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

export type MetricItem = {
  label: string
  value: string | number
  hint?: string
  icon?: LucideIcon
  variant?: "default" | "warning" | "success"
  href?: string
}

export function MetricStrip({ items, className }: { items: MetricItem[]; className?: string }) {
  if (items.length === 0) return null

  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {items.map((item, index) => {
        const Icon = item.icon
        const inner = (
          <div
            className={cn(
              "animate-stagger-item",
              "group relative overflow-hidden rounded-xl border px-4 py-3.5 transition-shadow",
              item.variant === "warning" && "border-amber-200/90 bg-amber-50/60",
              item.variant === "success" && "border-emerald-200/90 bg-emerald-50/50",
              (!item.variant || item.variant === "default") &&
                "border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:shadow-[0_2px_8px_rgba(15,23,42,0.05)]",
              item.href &&
                "hover:border-primary-200 hover:bg-primary-50/20 active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
            )}
            style={{ "--stagger-index": index } as CSSProperties}
          >
            {(!item.variant || item.variant === "default") && (
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-primary-500/0 transition-colors group-hover:bg-primary-500/40"
                aria-hidden
              />
            )}
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-medium text-neutral-500">{item.label}</p>
              {Icon ? (
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    item.variant === "warning" && "bg-amber-100/80 text-amber-700",
                    item.variant === "success" && "bg-emerald-100/80 text-emerald-700",
                    (!item.variant || item.variant === "default") && "bg-primary-50 text-primary-600"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
              ) : null}
            </div>
            <p
              className={cn(
                "mt-2 text-2xl font-bold tabular-nums tracking-tight",
                item.variant === "warning" && "text-amber-900",
                item.variant === "success" && "text-emerald-900",
                (!item.variant || item.variant === "default") && "text-neutral-950"
              )}
            >
              {item.value}
            </p>
            {item.hint ? (
              <p className="mt-1 text-xs text-neutral-500">
                {item.href ? (
                  <span className="text-primary-600 group-hover:underline">{item.hint}</span>
                ) : (
                  item.hint
                )}
              </p>
            ) : null}
          </div>
        )

        if (item.href) {
          return (
            <Link key={item.label} href={item.href} className="block rounded-xl">
              {inner}
            </Link>
          )
        }

        return <div key={item.label}>{inner}</div>
      })}
    </div>
  )
}
