"use client"

import * as React from "react"

/**
 * Odontogram pattern: load static SVG from public/, inject once, sync via DOM classes.
 * Reuse for consent letterheads, body maps, etc.
 */
export function useExternalSvg(url: string) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [ready, setReady] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setReady(false)
    setError(null)

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`SVG load failed: ${r.status}`)
        return r.text()
      })
      .then((html) => {
        if (cancelled || !containerRef.current) return
        containerRef.current.innerHTML = html
        setReady(true)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "SVG load failed")
      })

    return () => {
      cancelled = true
    }
  }, [url])

  return { containerRef, ready, error }
}
