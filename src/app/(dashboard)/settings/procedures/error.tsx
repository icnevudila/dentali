"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function ProceduresSettingsError({
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
      title="Procedures catalog error"
      homeHref="/settings/procedures"
      homeLabel="Back to procedures"
    />
  )
}
