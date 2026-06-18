"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type StickyActionBarProps = {
  children: ReactNode
  className?: string
  /** Show only below this breakpoint (default: md hidden on desktop) */
  mobileOnly?: boolean
}

/** Primary actions that stay visible while scrolling on narrow viewports. */
export function StickyActionBar({
  children,
  className,
  mobileOnly = true,
}: StickyActionBarProps) {
  return (
    <div
      className={cn(
        "sticky top-0 z-20 -mx-1 border-b border-neutral-200/80 bg-white/95 px-1 py-2 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-sm supports-[backdrop-filter]:bg-white/80",
        mobileOnly && "md:hidden",
        className
      )}
    >
      {children}
    </div>
  )
}
