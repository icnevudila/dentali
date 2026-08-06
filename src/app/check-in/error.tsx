"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function CheckInError({
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
      title="Check-in unavailable"
      homeHref="/welcome"
      homeLabel="Back to home"
      publicSurface
    />
  )
}
