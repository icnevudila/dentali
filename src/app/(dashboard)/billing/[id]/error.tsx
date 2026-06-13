"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function InvoiceDetailError({
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
      title="Invoice could not load"
      homeHref="/billing"
      homeLabel="Back to invoices"
    />
  )
}
