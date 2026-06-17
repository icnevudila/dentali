"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function PatientNotesError({
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
      title="Clinical notes error"
      homeHref="/patients"
      homeLabel="Back to patient registry"
    />
  )
}
