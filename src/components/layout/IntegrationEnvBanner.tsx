"use client"

import { AlertTriangle, CheckCircle2, Info } from "lucide-react"
import { cn } from "@/lib/utils"

export type IntegrationEnvTone = "warning" | "ready" | "empty"

/**
 * Staff-facing honesty banner for payment / claims integrations.
 * - warning: dry-run / sandbox / not live clearinghouse
 * - empty: required secrets not configured (same amber treatment, distinct for tests)
 * - ready: live secrets configured
 */
export function IntegrationEnvBanner({
  title,
  description,
  tone = "warning",
  className,
}: {
  title: string
  description: string
  tone?: IntegrationEnvTone
  className?: string
}) {
  const isReady = tone === "ready"
  const isEmpty = tone === "empty"
  const Icon = isReady ? CheckCircle2 : isEmpty ? Info : AlertTriangle

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
      data-tone={tone}
      data-testid="integration-env-banner"
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
