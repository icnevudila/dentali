"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

type CollapsibleBelowFoldProps = {
  summary: string
  children: React.ReactNode
  className?: string
  /** Start collapsed on viewports below lg (default true) */
  collapseOnMobile?: boolean
}

/** Summary grids and secondary metrics — collapsed on mobile by default. */
export function CollapsibleBelowFold({
  summary,
  children,
  className,
  collapseOnMobile = true,
}: CollapsibleBelowFoldProps) {
  const [open, setOpen] = React.useState(false)

  if (!collapseOnMobile) {
    return <div className={className}>{children}</div>
  }

  return (
    <>
      <div className={cn("lg:hidden", className)}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left text-sm font-medium text-neutral-800 shadow-sm"
          aria-expanded={open}
        >
          <span>{summary}</span>
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 text-neutral-500 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
        {open ? <div className="mt-3">{children}</div> : null}
      </div>
      <div className={cn("hidden lg:block", className)}>{children}</div>
    </>
  )
}
