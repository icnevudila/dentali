"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function SatisfactionReportError({
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
      title="Satisfaction report error"
      homeHref="/reports"
      homeLabel="Back to reports"
    />
  )
}
