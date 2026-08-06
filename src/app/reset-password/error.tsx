"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function ResetPasswordError({
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
      title="Password update unavailable"
      homeHref="/forgot-password"
      homeLabel="Request a new link"
    />
  )
}
