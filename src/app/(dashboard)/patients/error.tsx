"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function PatientsError({
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
      title="Patients module error"
      homeHref="/patients"
      homeLabel="Back to patient registry"
    />
  )
}
