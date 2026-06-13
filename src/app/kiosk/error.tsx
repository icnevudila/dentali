"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function KioskError({
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
      title="Kiosk unavailable"
      homeHref="/welcome"
      homeLabel="Back to home"
    />
  )
}
