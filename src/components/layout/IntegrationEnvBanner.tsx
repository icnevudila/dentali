"use client"

import { AlertTriangle, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

export function IntegrationEnvBanner({
  title,
  description,
  tone = "warning",
  className,
}: {
  title: string
  description: string
  /** warning = not connected / dry-run; ready = live secrets configured */
  tone?: "warning" | "ready"
  className?: string
}) {
  const isReady = tone === "ready"
  const Icon = isReady ? CheckCircle2 : AlertTriangle

  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border px-4 py-3 text-sm",
        isReady
          ? "border-emerald-200 bg-emerald-50 text-emerald-950"
          : "border-amber-200 bg-amber-50 text-amber-950",
        className
      )}
      role="status"
    >
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          isReady ? "text-emerald-700" : "text-amber-700"
        )}
        aria-hidden
      />
      <div>
        <p className="font-medium">{title}</p>
        <p className={cn("mt-1", isReady ? "text-emerald-900/90" : "text-amber-900/90")}>
          {description}
        </p>
      </div>
    </div>
  )
}
