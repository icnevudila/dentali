"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function QueueError({
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
      title="Queue board error"
      homeHref="/queue"
      homeLabel="Back to queue"
    />
  )
}
