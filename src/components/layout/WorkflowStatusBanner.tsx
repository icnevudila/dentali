"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { fetchWorkflowSettings } from "@/lib/analytics/analytics-service"
import { WorkflowSettingsLink } from "@/components/layout/WorkflowSettingsLink"

type WorkflowStatusItem = {
  key: string
  label: string
}

type WorkflowStatusBannerProps = {
  title: string
  description: string
  items: WorkflowStatusItem[]
}

export function WorkflowStatusBanner({
  title,
  description,
  items,
}: WorkflowStatusBannerProps) {
  const { activeBranch } = useBranch()
  const { t } = useLocale()
  const [settingsState, setSettingsState] = React.useState<{
    branchId: string | null
    data: Record<string, boolean> | null
  }>({
    branchId: null,
    data: null,
  })

  React.useEffect(() => {
    if (!activeBranch) return

    let cancelled = false
    void fetchWorkflowSettings(activeBranch.id).then(({ data }) => {
      if (!cancelled) {
        setSettingsState({
          branchId: activeBranch.id,
          data,
        })
      }
    })

    return () => {
      cancelled = true
    }
  }, [activeBranch])

  if (!activeBranch || items.length === 0) return null

  const settings =
    settingsState.branchId === activeBranch.id ? settingsState.data : null

  if (!settings) return null

  const disabledCount = items.filter((item) => settings[item.key] === false).length
  const toneClassName =
    disabledCount > 0
      ? "border-amber-200/90 bg-amber-50/70"
      : "border-emerald-200/90 bg-emerald-50/60"

  return (
    <div className={`rounded-xl border px-4 py-3 animate-fade-rise ${toneClassName}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-950">{title}</p>
          <p className="mt-1 text-sm text-neutral-700">{description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {items.map((item) => {
              const enabled = settings[item.key] !== false
              return (
                <Badge
                  key={item.key}
                  variant={enabled ? "success" : "warning"}
                  className="gap-1.5 font-normal"
                >
                  <span>{item.label}</span>
                  <span className="opacity-80">
                    {enabled ? t("common.on", "On") : t("common.off", "Off")}
                  </span>
                </Badge>
              )
            })}
          </div>
        </div>
        <WorkflowSettingsLink className="shrink-0 self-start" />
      </div>
    </div>
  )
}
