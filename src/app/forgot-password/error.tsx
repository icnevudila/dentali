"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function ForgotPasswordError({
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
      title="Password reset unavailable"
      homeHref="/login"
      homeLabel="Back to sign in"
    />
  )
}
