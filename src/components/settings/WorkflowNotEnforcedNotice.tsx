"use client"

import { Info } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Compact honesty chip for policies that are configured in workflow settings
 * but are not charged or gated in booking / no-show flows yet.
 */
export function WorkflowNotEnforcedNotice({
  title,
  description,
  className,
}: {
  title: string
  description: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700",
        className
      )}
      role="status"
      data-testid="workflow-not-enforced-notice"
    >
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-500" aria-hidden />
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium text-neutral-900">{title}</p>
        <p className="text-neutral-600">{description}</p>
      </div>
    </div>
  )
}
