"use client"

import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

export function IntegrationEnvBanner({
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
        "flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950",
        className
      )}
      role="status"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-amber-900/90">{description}</p>
      </div>
    </div>
  )
}
