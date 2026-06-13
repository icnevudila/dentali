"use client"

import * as React from "react"

const SCROLL_THRESHOLD_PX = 16

/** Detects when the consent document has been read (scrolled to end or no scroll needed). */
export function useConsentScrollGate(resetKey: string | number = 0) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [hasReachedEnd, setHasReachedEnd] = React.useState(false)
  const [needsScroll, setNeedsScroll] = React.useState(false)
  const [scrollProgress, setScrollProgress] = React.useState(0)
  const [prevResetKey, setPrevResetKey] = React.useState(resetKey)

  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey)
    setHasReachedEnd(false)
    setNeedsScroll(false)
    setScrollProgress(0)
  }

  const evaluate = React.useCallback(() => {
    const el = scrollRef.current
    if (!el) return

    const scrollable = el.scrollHeight > el.clientHeight + SCROLL_THRESHOLD_PX
    setNeedsScroll(scrollable)

    const atEnd =
      !scrollable ||
      el.scrollHeight - el.scrollTop <= el.clientHeight + SCROLL_THRESHOLD_PX

    if (atEnd) setHasReachedEnd(true)

    const maxScroll = Math.max(el.scrollHeight - el.clientHeight, 1)
    setScrollProgress(Math.min(100, (el.scrollTop / maxScroll) * 100))
  }, [])

  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (el.scrollHeight - el.scrollTop <= el.clientHeight + SCROLL_THRESHOLD_PX) {
      setHasReachedEnd(true)
    }
    const maxScroll = Math.max(el.scrollHeight - el.clientHeight, 1)
    setScrollProgress(Math.min(100, (el.scrollTop / maxScroll) * 100))
  }, [])

  const acknowledgeRead = React.useCallback(() => {
    setHasReachedEnd(true)
  }, [])

  React.useEffect(() => {
    const frame = requestAnimationFrame(() => evaluate())
    const el = scrollRef.current
    if (!el) return () => cancelAnimationFrame(frame)

    const ro = new ResizeObserver(() => evaluate())
    ro.observe(el)
    window.addEventListener("resize", evaluate)

    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
      window.removeEventListener("resize", evaluate)
    }
  }, [evaluate, resetKey])

  return { scrollRef, hasReachedEnd, needsScroll, scrollProgress, handleScroll, acknowledgeRead }
}
