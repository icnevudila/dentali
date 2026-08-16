"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export type HorizontalScrollTab = {
  id: string
  label: string
  icon?: LucideIcon
}

export function HorizontalScrollTabs({
  tabs,
  activeId,
  onSelect,
  ariaLabel,
  stickyClassName = "sticky top-0 z-20",
  activeVariant = "solid",
}: {
  tabs: HorizontalScrollTab[]
  activeId: string | null
  onSelect: (id: string) => void
  ariaLabel: string
  stickyClassName?: string
  activeVariant?: "solid" | "soft"
}) {
  const scrollerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const root = scrollerRef.current
    if (!root) return
    const active = root.querySelector<HTMLElement>('[data-tab-active="true"]')
    active?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" })
  }, [activeId])

  return (
    <div className={cn("relative min-w-0", stickyClassName)}>
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-white to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-white to-transparent"
        aria-hidden
      />
      <div
        ref={scrollerRef}
        role="tablist"
        aria-label={ariaLabel}
        className="flex gap-1 overflow-x-auto overscroll-x-contain scroll-px-3 snap-x snap-mandatory hide-scrollbar rounded-lg border border-neutral-200 bg-white/95 p-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur-sm"
      >
        {tabs.map((tab) => {
          const isActive = activeId === tab.id
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-tab-active={isActive ? "true" : "false"}
              onClick={() => onSelect(tab.id)}
              className={cn(
                "inline-flex shrink-0 snap-start items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-150 sm:text-sm",
                // Solid variant (main patient tabs)
                isActive && activeVariant === "solid" &&
                  "bg-primary-600 text-white font-semibold shadow-[0_1px_4px_rgba(0,82,204,0.35)]",
                // Soft variant (inner record sub-nav)
                isActive && activeVariant === "soft" &&
                  "bg-primary-50 text-primary-700 font-semibold border border-primary-200 shadow-[0_1px_2px_rgba(0,82,204,0.12)]",
                // Inactive
                !isActive && "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              )}
            >
              {Icon ? (
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    isActive && activeVariant === "solid"
                      ? "text-white"
                      : isActive && activeVariant === "soft"
                        ? "text-primary-500"
                        : "text-neutral-400"
                  )}
                />
              ) : null}
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
