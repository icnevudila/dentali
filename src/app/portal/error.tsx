"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function PortalError({
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
      title="Patient portal unavailable"
      homeHref="/welcome"
      homeLabel="Back to home"
      publicSurface
    />
  )
}
