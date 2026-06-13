"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function SignRouteError({
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
      title="Consent signing unavailable"
      homeHref="/welcome"
      homeLabel="Back to home"
    />
  )
}
