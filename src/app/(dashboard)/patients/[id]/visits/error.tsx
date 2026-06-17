"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function PatientVisitsError({
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
      title="Patient visits error"
      homeHref="/patients"
      homeLabel="Back to patient registry"
    />
  )
}
