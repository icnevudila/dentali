"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

type CollapsibleGuideProps = {
  summary: string
  children: React.ReactNode
  className?: string
}

/** Full guide on desktop; collapsed toggle on mobile to save scroll. */
export function CollapsibleGuide({ summary, children, className }: CollapsibleGuideProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <div className={cn("lg:hidden", className)}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-3 text-left text-sm font-medium text-neutral-800"
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
