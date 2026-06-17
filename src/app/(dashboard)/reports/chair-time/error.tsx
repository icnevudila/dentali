"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function ChairTimeError({
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
      title="Chair-time report error"
      homeHref="/reports/chair-time"
      homeLabel="Back to chair-time report"
    />
  )
}
