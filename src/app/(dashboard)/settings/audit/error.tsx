"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function AuditLogError({
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
      title="Audit log error"
      homeHref="/settings/audit"
      homeLabel="Back to audit log"
    />
  )
}
