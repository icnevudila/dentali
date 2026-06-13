"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function PhilHealthError({
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
      title="PhilHealth sync error"
      homeHref="/billing/philhealth"
      homeLabel="Back to PhilHealth"
    />
  )
}
