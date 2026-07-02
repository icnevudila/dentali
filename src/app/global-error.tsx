"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

/**
 * Next.js global-error catches errors that happen INSIDE the root layout
 * (including layout.tsx itself). It MUST render its own <html>/<body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body>
        <RouteErrorFallback
          error={error}
          reset={reset}
          title="Application error"
          homeHref="/welcome"
          homeLabel="Go to welcome"
        />
      </body>
    </html>
  )
}
