"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function PdaError({
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
      title="Intake form unavailable"
      homeHref="/welcome"
      homeLabel="Back to home"
      publicSurface
    />
  )
}
