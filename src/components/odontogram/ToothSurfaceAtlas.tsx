"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { TOOTH_SURFACE_ATLAS_SVG } from "@/lib/odontogram/svg-assets"

export function ToothSurfaceAtlas({ className }: { className?: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    let cancelled = false
    fetch("/odontogram/interactive-odontogram.svg")
      .then((res) => (res.ok ? res.text() : Promise.reject()))
      .then((markup) => {
        if (cancelled || !containerRef.current) return
        const parser = new DOMParser()
        const doc = parser.parseFromString(markup, "image/svg+xml")
        const anatomyPanel = doc.getElementById("anatomy-panel")
        if (anatomyPanel) {
          // Remove transform to align it to 0,0
          anatomyPanel.removeAttribute("transform")
          const styles = doc.querySelector("style")?.innerHTML || ""
          const svgHtml = `
            <svg viewBox="0 0 345 650" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto">
              <style>${styles}</style>
              ${anatomyPanel.outerHTML}
            </svg>
          `
          containerRef.current.innerHTML = svgHtml
        }
      })
      .catch((err) => {
        console.error("ToothSurfaceAtlas: failed to load anatomy panel", err)
      })

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
