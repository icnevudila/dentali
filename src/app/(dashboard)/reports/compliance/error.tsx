"use client"

import { RouteErrorFallback } from "@/components/layout/RouteErrorFallback"

export default function ComplianceReportError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteErrorFallback error={error} reset={reset} title="Compliance report error" homeHref="/reports" homeLabel="Back to reports" />
}
