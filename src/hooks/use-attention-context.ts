"use client"

import * as React from "react"
import { usePermissionStore } from "@/stores/permission-store"
import { fetchWorkflowSettings } from "@/lib/analytics/analytics-service"
import { useBranch } from "@/hooks/use-branch"

/** Permissions + branch workflow toggles for dashboard attention rule engine */
export function useAttentionContext() {
  const { activeBranch } = useBranch()
  const permissions = usePermissionStore((s) => s.permissions)
  const [workflowSettings, setWorkflowSettings] = React.useState<Record<string, boolean> | null>(
    null
  )

  React.useEffect(() => {
    if (!activeBranch) {
      setWorkflowSettings(null)
      return
    }
    let cancelled = false
    void fetchWorkflowSettings(activeBranch.id).then(({ data }) => {
      if (!cancelled) setWorkflowSettings(data)
    })
    return () => {
      cancelled = true
    }
  }, [activeBranch?.id])

  return {
    permissions,
    workflowSettings,
  }
}
