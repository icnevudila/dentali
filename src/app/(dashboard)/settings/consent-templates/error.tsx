"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function ConsentTemplatesError({
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
      title="Consent templates error"
      homeHref="/settings/consent-templates"
      homeLabel="Back to consent templates"
    />
  )
}
