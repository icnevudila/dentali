"use client"

import * as React from "react"
import { notifyIfError } from "@/lib/ui/notify"

/** Toasts page-level errors instead of rendering inline banners. */
export function PageErrorNotifier({
  error,
  onRetry,
}: {
  error?: string | null
  onRetry?: () => void
}) {
  const lastRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (!error || error === lastRef.current) return
    lastRef.current = error
    notifyIfError(error, onRetry)
  }, [error, onRetry])

  React.useEffect(() => {
    if (!error) lastRef.current = null
  }, [error])

  return null
}
