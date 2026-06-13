"use client"

import { cn } from "@/lib/utils"
import { useLocale } from "@/hooks/use-locale"

export function ConsentFieldProgress({
  completed,
  required,
  className,
}: {
  completed: number
  required: number
  className?: string
}) {
  const { t } = useLocale()

  if (required === 0) return null

  const allDone = completed >= required
  const ratio = required > 0 ? completed / required : 0

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className={cn("font-medium", allDone ? "text-primary-700" : "text-neutral-600")}>
          {allDone
            ? t("consent.allFieldsDone", "All required fields completed")
            : `${completed} of ${required} ${t("consent.requiredFields", "required fields")}`}
        </span>
        <span className="tabular-nums text-neutral-400">
          {completed}/{required}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-neutral-200/80">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-200",
            allDone ? "bg-primary-500" : "bg-primary-400"
          )}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
    </div>
  )
}
