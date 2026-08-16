"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export type HorizontalScrollTab = {
  id: string
  label: string
  icon?: LucideIcon
}

import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, LayoutGrid, Rows3 } from "lucide-react"

export function HorizontalScrollTabs({
  tabs,
  activeId,
  onSelect,
  ariaLabel,
  stickyClassName = "sticky top-0 z-20",
  activeVariant = "solid",
  allowExpand = true,
}: {
  tabs: HorizontalScrollTab[]
  activeId: string | null
  onSelect: (id: string) => void
  ariaLabel: string
  stickyClassName?: string
  activeVariant?: "solid" | "soft"
  allowExpand?: boolean
}) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const scrollerRef = React.useRef<HTMLDivElement>(null)
  const isDraggingRef = React.useRef(false)
  const hasDraggedRef = React.useRef(false)
  const startXRef = React.useRef(0)
  const scrollLeftRef = React.useRef(0)

  const [canScrollLeft, setCanScrollLeft] = React.useState(false)
  const [canScrollRight, setCanScrollRight] = React.useState(false)

  const updateScrollButtons = React.useCallback(() => {
    if (isExpanded) return
    const root = scrollerRef.current
    if (!root) return
    const { scrollLeft, scrollWidth, clientWidth } = root
    setCanScrollLeft(scrollLeft > 4)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4)
  }, [isExpanded])

  React.useEffect(() => {
    updateScrollButtons()
    const root = scrollerRef.current
    if (!root) return
    root.addEventListener("scroll", updateScrollButtons, { passive: true })
    window.addEventListener("resize", updateScrollButtons)
    return () => {
      root.removeEventListener("scroll", updateScrollButtons)
      window.removeEventListener("resize", updateScrollButtons)
    }
  }, [tabs, updateScrollButtons, isExpanded])

  React.useEffect(() => {
    if (isExpanded) return
    const root = scrollerRef.current
    if (!root) return
    const active = root.querySelector<HTMLElement>('[data-tab-active="true"]')
    if (!active) return
    const rootRect = root.getBoundingClientRect()
    const activeRect = active.getBoundingClientRect()
    const offset = activeRect.left - rootRect.left - (rootRect.width / 2) + (activeRect.width / 2)
    root.scrollBy({ left: offset, behavior: "smooth" })
  }, [activeId, isExpanded])

  // Mouse wheel horizontal scrolling
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (isExpanded) return
    const root = scrollerRef.current
    if (!root) return
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      root.scrollLeft += e.deltaY * 0.8
    }
  }

  // Mouse drag-to-scroll handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isExpanded) return
    const root = scrollerRef.current
    if (!root) return
    isDraggingRef.current = true
    hasDraggedRef.current = false
    startXRef.current = e.pageX - root.offsetLeft
    scrollLeftRef.current = root.scrollLeft
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isExpanded || !isDraggingRef.current) return
    const root = scrollerRef.current
    if (!root) return
    e.preventDefault()
    const x = e.pageX - root.offsetLeft
    const walk = (x - startXRef.current) * 1.3
    if (Math.abs(walk) > 4) {
      hasDraggedRef.current = true
    }
    root.scrollLeft = scrollLeftRef.current - walk
  }

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false
  }

  const scrollByAmount = (direction: "left" | "right") => {
    const root = scrollerRef.current
    if (!root) return
    const amount = direction === "left" ? -220 : 220
    root.scrollBy({ left: amount, behavior: "smooth" })
  }

  return (
    <div className={cn("relative min-w-0 group", stickyClassName)}>
      {/* Left Chevron Button */}
      {!isExpanded && canScrollLeft && (
        <button
          type="button"
          aria-label="Scroll tabs left"
          onClick={() => scrollByAmount("left")}
          className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 h-7 w-7 items-center justify-center rounded-full bg-white/95 shadow-md border border-neutral-200 text-neutral-600 hover:text-neutral-900 hover:bg-white transition-all"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}

      {/* Right Chevron Button */}
      {!isExpanded && canScrollRight && (
        <button
          type="button"
          aria-label="Scroll tabs right"
          onClick={() => scrollByAmount("right")}
          className="hidden sm:flex absolute right-9 top-1/2 -translate-y-1/2 z-20 h-7 w-7 items-center justify-center rounded-full bg-white/95 shadow-md border border-neutral-200 text-neutral-600 hover:text-neutral-900 hover:bg-white transition-all"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* Fade Gradients */}
      {!isExpanded && (
        <>
          <div
            className={cn(
              "pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-white to-transparent transition-opacity",
              canScrollLeft ? "opacity-100" : "opacity-0"
            )}
            aria-hidden
          />
          <div
            className={cn(
              "pointer-events-none absolute inset-y-0 right-8 z-10 w-6 bg-gradient-to-l from-white to-transparent transition-opacity",
              canScrollRight ? "opacity-100" : "opacity-0"
            )}
            aria-hidden
          />
        </>
      )}

      <div className="flex items-center gap-1.5">
        <div
          ref={scrollerRef}
          role="tablist"
          aria-label={ariaLabel}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          className={cn(
            "flex-1 rounded-lg border border-neutral-200 bg-white/95 p-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur-sm transition-all duration-200",
            isExpanded
              ? "flex flex-wrap gap-1.5 p-2 overflow-visible"
              : "flex gap-1 overflow-x-auto overscroll-x-contain scroll-px-3 hide-scrollbar select-none cursor-grab active:cursor-grabbing pr-2"
          )}
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
                onClick={(e) => {
                  if (!isExpanded && hasDraggedRef.current) {
                    e.preventDefault()
                    e.stopPropagation()
                    return
                  }
                  onSelect(tab.id)
                }}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-150 sm:text-sm",
                  // Solid variant (main patient tabs)
                  isActive &&
                    activeVariant === "solid" &&
                    "bg-primary-600 text-white font-semibold shadow-[0_1px_4px_rgba(0,82,204,0.35)]",
                  // Soft variant (inner record sub-nav)
                  isActive &&
                    activeVariant === "soft" &&
                    "bg-primary-50 text-primary-700 font-semibold border border-primary-200 shadow-[0_1px_2px_rgba(0,82,204,0.12)]",
                  // Inactive
                  !isActive && "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
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

        {/* Expand / Collapse All Tabs Toggle Button */}
        {allowExpand && (
          <button
            type="button"
            title={isExpanded ? "Collapse tab bar" : "Expand all tabs"}
            aria-label={isExpanded ? "Collapse tab bar" : "Expand all tabs"}
            onClick={() => setIsExpanded((prev) => !prev)}
            className={cn(
              "shrink-0 h-9 px-2 flex items-center justify-center gap-1 rounded-lg border border-neutral-200 text-xs font-medium transition-all shadow-sm",
              isExpanded
                ? "bg-primary-50 text-primary-700 border-primary-300"
                : "bg-white text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
            )}
          >
            {isExpanded ? (
              <>
                <Rows3 className="h-3.5 w-3.5" />
                <span className="hidden md:inline text-[11px]">Collapse</span>
                <ChevronUp className="h-3 w-3" />
              </>
            ) : (
              <>
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden md:inline text-[11px]">All</span>
                <ChevronDown className="h-3 w-3" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
