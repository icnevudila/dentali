"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { TOOTH_SURFACE_ATLAS_SVG } from "@/lib/odontogram/svg-assets"

export function ToothSurfaceAtlas({ className }: { className?: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    let cancelled = false
    fetch(TOOTH_SURFACE_ATLAS_SVG)
      .then((res) => (res.ok ? res.text() : Promise.reject()))
      .then((markup) => {
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = markup
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={cn(
        "overflow-hidden rounded-lg border border-neutral-200 bg-white",
        "[&_svg]:h-auto [&_svg]:w-full",
        className
      )}
      aria-hidden
    />
  )
}
