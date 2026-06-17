"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function WorkflowSettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <RouteErrorFallback
      error={error}
      reset={reset}
      title="Workflow settings error"
      homeHref="/settings/workflow"
      homeLabel="Back to workflow settings"
    />
  )
}
