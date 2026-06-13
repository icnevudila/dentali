"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function RolesSettingsError({
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
      title="Roles settings error"
      homeHref="/settings/roles"
      homeLabel="Back to roles"
    />
  )
}
