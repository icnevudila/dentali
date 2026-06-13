"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function BranchesSettingsError({
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
      title="Branches settings error"
      homeHref="/settings/branches"
      homeLabel="Back to branches"
    />
  )
}
