"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function TreatmentPlansError({
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
      title="Treatment plans error"
      homeHref="/treatment-plans"
      homeLabel="Back to treatment plans"
    />
  )
}
