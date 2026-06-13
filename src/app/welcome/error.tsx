"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function WelcomeError({
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
      title="Welcome page unavailable"
      homeHref="/login"
      homeLabel="Sign in"
    />
  )
}
