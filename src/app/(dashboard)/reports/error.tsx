"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function ReportsError({
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
      title="Reports module error"
      homeHref="/reports"
      homeLabel="Back to reports"
    />
  )
}
