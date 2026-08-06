"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function KioskSettingsError({
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
      title="Kiosk settings error"
      homeHref="/settings"
      homeLabel="Back to settings"
    />
  )
}
