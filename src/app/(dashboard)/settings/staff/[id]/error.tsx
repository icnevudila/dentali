"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function StaffDetailError({
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
      title="Staff profile error"
      homeHref="/settings/staff"
      homeLabel="Back to staff"
    />
  )
}
