"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function DisplayError({
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
      title="Queue display unavailable"
      homeHref="/welcome"
      homeLabel="Back to home"
    />
  )
}
