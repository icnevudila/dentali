"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function SettingsError({
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
      title="Settings error"
      homeHref="/settings/organization"
      homeLabel="Back to settings"
    />
  )
}
