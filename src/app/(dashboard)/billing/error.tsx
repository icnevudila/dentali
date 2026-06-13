"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function BillingError({
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
      title="Billing module error"
      homeHref="/billing"
      homeLabel="Back to billing"
    />
  )
}
