"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function StaffSettingsError({
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
      title="Staff settings error"
      homeHref="/settings/staff"
      homeLabel="Back to staff"
    />
  )
}
