"use client"

import { cn } from "@/lib/utils"
import type { ToothFinding } from "@/lib/types/dental"
import { COMPACT_ODONTOGRAM_SVG } from "@/lib/odontogram/svg-assets"
import { useOdontogramSvg } from "@/hooks/use-odontogram-svg"

/** Read-only compact odontogram SVG for lists, tables, and profile summaries */
export function CompactOdontogramSvg({
  findings = [],
  className,
  size = "sm",
}: {
  findings?: ToothFinding[]
  className?: string
  size?: "sm" | "md"
}) {
  const { containerRef, loadState } = useOdontogramSvg({
    svgPath: COMPACT_ODONTOGRAM_SVG,
    svgId: "compact-odontogram",
    findings,
    compact: true,
    interactive: false,
  })

  return (
    <div
      ref={containerRef}
      className={cn(
        "shrink-0 overflow-hidden rounded-md border border-neutral-200 bg-neutral-50/80",
        size === "sm" ? "h-7 w-[4.75rem]" : "h-10 w-[5.75rem]",
        loadState !== "ready" && "animate-pulse bg-neutral-100",
        "[&_svg]:h-full [&_svg]:w-full",
        className
      )}
      role="img"
      aria-label="Dental chart summary"
    />
  )
}
