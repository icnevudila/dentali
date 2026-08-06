"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function SignupError({
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
      title="Sign-up unavailable"
      homeHref="/welcome"
      homeLabel="Back to home"
    />
  )
}
