"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function LabCasesError({
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
      title="Laboratory cases error"
      homeHref="/lab-cases"
      homeLabel="Back to lab cases"
    />
  )
}
