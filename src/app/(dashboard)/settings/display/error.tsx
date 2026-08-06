"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function DisplaySettingsError({
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
      title="Display settings error"
      homeHref="/settings"
      homeLabel="Back to settings"
    />
  )
}
