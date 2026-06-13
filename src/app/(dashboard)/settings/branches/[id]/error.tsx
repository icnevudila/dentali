"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function BranchDetailError({
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
      title="Branch settings error"
      homeHref="/settings/branches"
      homeLabel="Back to branches"
    />
  )
}
