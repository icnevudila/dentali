"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function MarketingError({
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
      title="Page unavailable"
      homeHref="/welcome"
      homeLabel="Back to home"
    />
  )
}
