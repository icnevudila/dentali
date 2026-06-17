"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function PatientConsentsError({
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
      title="Patient consents error"
      homeHref="/patients"
      homeLabel="Back to patient registry"
    />
  )
}
