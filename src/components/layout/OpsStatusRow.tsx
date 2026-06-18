"use client"

import * as React from "react"
import { AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { fetchWorkflowSettings } from "@/lib/analytics/analytics-service"
import { WorkflowSettingsLink } from "@/components/layout/WorkflowSettingsLink"
import { cn } from "@/lib/utils"

export type OpsWorkflowItem = {
  key: string
  label: string
}

type OpsStatusRowProps = {
  workflowItems?: OpsWorkflowItem[]
  /** Branch badge, pending counts, etc. */
  extra?: React.ReactNode
  className?: string
}

/**
 * Compact status chips. Full workflow detail only when something is off;
 * when all automations are on, workflow chrome is hidden (extra chips still show).
 */
export function OpsStatusRow({ workflowItems = [], extra, className }: OpsStatusRowProps) {
  const { activeBranch } = useBranch()
  const { t } = useLocale()
  const [settings, setSettings] = React.useState<Record<string, boolean> | null>(null)

  React.useEffect(() => {
    if (!activeBranch || workflowItems.length === 0) return
    let cancelled = false
    void fetchWorkflowSettings(activeBranch.id).then(({ data }) => {
      if (!cancelled) setSettings(data)
    })
    return () => {
      cancelled = true
    }
  }, [activeBranch, workflowItems.length])

  if (!activeBranch && !extra) return null

  const offItems =
    settings && workflowItems.length > 0
      ? workflowItems.filter((item) => settings[item.key] === false)
      : []

  const showWorkflowWarning = offItems.length > 0

  if (!showWorkflowWarning && !extra) return null

  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
        showWorkflowWarning &&
          "rounded-xl border border-amber-200/90 bg-amber-50/60 px-3 py-2",
        className
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {extra}
        {showWorkflowWarning ? (
          <>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-900">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {t("workflow.automationAttention", "Automation needs attention")}
            </span>
            {offItems.map((item) => (
              <Badge key={item.key} variant="warning" className="gap-1 font-normal text-[11px]">
                {item.label}
                <span className="opacity-80">{t("common.off", "Off")}</span>
              </Badge>
            ))}
          </>
        ) : null}
      </div>
      {workflowItems.length > 0 ? (
        <WorkflowSettingsLink className="shrink-0 self-start sm:self-center" />
      ) : null}
    </div>
  )
}
