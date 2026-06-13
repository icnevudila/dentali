"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ScrollRevealProps {
  children: React.ReactNode
  className?: string
  direction?: "up" | "left" | "right" | "scale"
  delay?: number
  threshold?: number
}

export function ScrollReveal({
  children,
  className,
  direction = "up",
  delay = 0,
  threshold = 0.15,
}: ScrollRevealProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [revealed, setRevealed] = React.useState(false)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return

    // Check reduced motion preference
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReducedMotion) {
      setRevealed(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true)
          observer.unobserve(el)
        }
      },
      { threshold }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  const dirClass =
    direction === "left"
      ? "landing-reveal-left"
      : direction === "right"
        ? "landing-reveal-right"
        : direction === "scale"
          ? "landing-reveal-scale"
          : "landing-reveal"

  return (
    <div
      ref={ref}
      className={cn(dirClass, revealed && "revealed", className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}

/* Staggered group — wraps children and adds stagger index */
export function ScrollRevealGroup({
  children,
  className,
  staggerMs = 80,
}: {
  children: React.ReactNode
  className?: string
  staggerMs?: number
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [revealed, setRevealed] = React.useState(false)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReducedMotion) {
      setRevealed(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true)
          observer.unobserve(el)
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className={className}>
      {React.Children.map(children, (child, i) => {
        if (!React.isValidElement(child)) return child
        return (
          <div
            className={cn("landing-reveal", revealed && "revealed")}
            style={{ transitionDelay: `${i * staggerMs}ms` }}
          >
            {child}
          </div>
        )
      })}
    </div>
  )
}
