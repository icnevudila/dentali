"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function StaffInviteError({
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
      title="Staff invite error"
      homeHref="/settings/staff/invite"
      homeLabel="Back to invite"
    />
  )
}
