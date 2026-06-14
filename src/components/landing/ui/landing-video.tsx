"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type LandingVideoProps = {
  src: string
  poster?: string
  className?: string
  label?: string
  active?: boolean
}

export function LandingVideo({ src, poster, className, label, active = true }: LandingVideoProps) {
  const ref = React.useRef<HTMLVideoElement>(null)

  React.useEffect(() => {
    const video = ref.current
    if (!video) return

    if (active) {
      video.currentTime = 0
      void video.play().catch(() => {})
    } else {
      video.pause()
    }
  }, [active, src])

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-label={label}
      className={cn("absolute inset-0 h-full w-full object-cover object-top", className)}
    />
  )
}
