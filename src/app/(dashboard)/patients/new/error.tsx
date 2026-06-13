"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function NewPatientError({
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
      title="New patient intake error"
      homeHref="/patients/new"
      homeLabel="Try intake again"
    />
  )
}
