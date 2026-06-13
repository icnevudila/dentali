"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function OrganizationSettingsError({
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
      title="Organization settings error"
      homeHref="/settings/organization"
      homeLabel="Back to organization"
    />
  )
}
