"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function CloseoutError({
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
      title="Closeout report error"
      homeHref="/reports/closeout"
      homeLabel="Back to closeout"
    />
  )
}
