"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <RouteErrorFallback error={error} reset={reset} />
}
