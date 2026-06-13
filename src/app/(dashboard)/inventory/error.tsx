"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function InventoryError({
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
      title="Inventory module error"
      homeHref="/inventory"
      homeLabel="Back to inventory"
    />
  )
}
