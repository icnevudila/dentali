"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface AnimatedCounterProps {
  value: number
  suffix?: string
  duration?: number
  className?: string
}

export function AnimatedCounter({
  value,
  suffix = "",
  duration = 1500,
  className,
}: AnimatedCounterProps) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const [display, setDisplay] = React.useState("0")
  const [done, setDone] = React.useState(false)
  const startedRef = React.useRef(false)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReducedMotion) {
      setDisplay(formatNumber(value))
      setDone(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !startedRef.current) {
          startedRef.current = true
          animateCount()
          observer.unobserve(el)
        }
      },
      { threshold: 0.3 }
    )

    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration])

  function animateCount() {
    const start = performance.now()
    const isDecimal = value % 1 !== 0

    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // easeOutExpo
      const eased = 1 - Math.pow(2, -10 * progress)
      const current = eased * value

      setDisplay(formatNumber(isDecimal ? parseFloat(current.toFixed(1)) : Math.floor(current)))

      if (progress < 1) {
        requestAnimationFrame(tick)
      } else {
        setDisplay(formatNumber(value))
        setDone(true)
      }
    }

    requestAnimationFrame(tick)
  }

  return (
    <span ref={ref} className={cn(done && "landing-counter-done", className)}>
      {display}
      {suffix}
    </span>
  )
}

function formatNumber(n: number): string {
  if (n >= 1000) {
    return n.toLocaleString("en-US")
  }
  return String(n)
}
