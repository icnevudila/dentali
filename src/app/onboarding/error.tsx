"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function OnboardingError({
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
      title="Onboarding error"
      homeHref="/login"
      homeLabel="Back to sign in"
    />
  )
}
