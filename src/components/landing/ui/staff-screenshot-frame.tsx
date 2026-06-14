"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { DentQLLogo } from "@/components/brand/dentql-logo"

/**
 * Covers baked-in app topbar (username text) on staff UI screenshots.
 */
export function StaffScreenshotFrame({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      {children}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-3 sm:px-4"
        aria-hidden
      >
        <DentQLLogo size="sm" />
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span className="hidden max-w-[9rem] truncate text-xs font-medium text-neutral-600 sm:inline">
            Main Clinic
          </span>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
            AL
          </div>
        </div>
      </div>
    </div>
  )
}
