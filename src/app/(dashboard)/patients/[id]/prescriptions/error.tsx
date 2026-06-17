"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function PatientPrescriptionsError({
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
      title="Prescriptions error"
      homeHref="/patients"
      homeLabel="Back to patient registry"
    />
  )
}
