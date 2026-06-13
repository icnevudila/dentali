"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function AppointmentsError({
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
      title="Appointments module error"
      homeHref="/appointments"
      homeLabel="Back to calendar"
    />
  )
}
