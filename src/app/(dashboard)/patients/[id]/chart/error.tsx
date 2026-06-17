"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function PatientChartError({
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
      title="Dental chart error"
      homeHref="/patients"
      homeLabel="Back to patient registry"
    />
  )
}
