"use client"

import type { ToothFinding } from "@/lib/types/dental"
import { CompactOdontogramSvg } from "./CompactOdontogramSvg"

/** Compact read-only odontogram for lists and profile summaries */
export function MiniOdontogram({
  findings = [],
  className,
  size = "sm",
}: {
  findings?: ToothFinding[]
  className?: string
  size?: "sm" | "md"
}) {
  return (
    <CompactOdontogramSvg findings={findings} className={className} size={size} />
  )
}
