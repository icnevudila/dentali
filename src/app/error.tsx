"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function GlobalError({
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
      title="Application error"
      homeHref="/login"
      homeLabel="Go to login"
    />
  )
}
