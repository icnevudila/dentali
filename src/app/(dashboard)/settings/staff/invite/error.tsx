"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"
import { useLocale } from "@/hooks/use-locale"

export default function StaffInviteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useLocale()
  return (
    <RouteErrorFallback
      error={error}
      reset={reset}
      title={t("settings.staffInviteError", "Staff invite error")}
      homeHref="/settings/staff/invite"
      homeLabel={t("settings.backToInvite", "Back to invite")}
    />
  )
}
