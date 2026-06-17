"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function TreatmentPlanError({
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
      title="Treatment plan error"
      homeHref="/patients"
      homeLabel="Back to patient registry"
    />
  )
}
