"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function DentistError({
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
      title="Dentist workspace error"
      homeHref="/dentist"
      homeLabel="Back to today's chair"
    />
  )
}
