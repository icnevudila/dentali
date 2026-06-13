"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function NotificationsSettingsError({
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
      title="Notifications settings error"
      homeHref="/settings/notifications"
      homeLabel="Back to notifications"
    />
  )
}
