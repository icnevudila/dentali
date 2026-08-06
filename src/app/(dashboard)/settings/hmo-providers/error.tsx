"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function HmoProvidersSettingsError({
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
      title="HMO providers settings error"
      homeHref="/settings"
      homeLabel="Back to settings"
    />
  )
}
