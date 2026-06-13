"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function WaitlistError({
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
      title="Waitlist error"
      homeHref="/waitlist"
      homeLabel="Back to waitlist"
    />
  )
}
