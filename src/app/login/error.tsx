"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function LoginError({
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
      title="Sign-in unavailable"
      homeHref="/welcome"
      homeLabel="Back to home"
    />
  )
}
