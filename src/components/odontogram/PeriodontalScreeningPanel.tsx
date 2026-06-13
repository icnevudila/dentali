"use client"

import * as React from "react"
import { PERIODONTAL_SCREENING_SVG } from "@/lib/odontogram/svg-assets"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

/** Reference panel for PSR / BOP screening sites — full chart module queued separately */
export function PeriodontalScreeningPanel({
  patientId,
  className,
}: {
  patientId: string
  className?: string
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    let cancelled = false
    fetch(PERIODONTAL_SCREENING_SVG)
      .then((res) => (res.ok ? res.text() : Promise.reject()))
      .then((markup) => {
        if (!cancelled && containerRef.current) containerRef.current.innerHTML = markup
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Periodontal screening</CardTitle>
        <CardDescription>Six-site PSR / BOP reference per sextant</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          ref={containerRef}
          className="overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50/80 [&_svg]:h-auto [&_svg]:w-full"
          aria-hidden
        />
        <p className="text-xs leading-relaxed text-neutral-500">
          Record gum screening in medical history. Full pocket chart (6 sites × 32 teeth) is on the polish queue.
        </p>
        <Link
          href={`/patients/${patientId}/medical-history`}
          className="text-xs font-medium text-primary-700 hover:underline"
        >
          Open medical history →
        </Link>
      </CardContent>
    </Card>
  )
}
