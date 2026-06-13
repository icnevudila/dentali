"use client"

import { cn } from "@/lib/utils"

export function ConsentScrollProgress({
  progress,
  visible,
  className,
}: {
  progress: number
  visible: boolean
  className?: string
}) {
  if (!visible) return null

  const clamped = Math.min(100, Math.max(0, progress))

  return (
    <div
      className={cn("pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-neutral-100", className)}
      aria-hidden
    >
      <div
        className="h-full bg-primary-500 transition-[width] duration-150 ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
