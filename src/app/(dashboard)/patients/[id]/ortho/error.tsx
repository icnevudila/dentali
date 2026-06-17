"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function PatientOrthoError({
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
      title="Orthodontic record error"
      homeHref="/patients"
      homeLabel="Back to patient registry"
    />
  )
}
