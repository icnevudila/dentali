"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function HmoClaimsError({
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
      title="HMO claims error"
      homeHref="/billing/hmo"
      homeLabel="Back to HMO claims"
    />
  )
}
