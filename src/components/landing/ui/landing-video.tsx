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
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [posterHidden, setPosterHidden] = React.useState(false)

  React.useEffect(() => {
    setPosterHidden(false)
  }, [src])

  React.useEffect(() => {
    const video = ref.current
    const container = containerRef.current
    if (!video || !container) return

    video.muted = true
    video.defaultMuted = true
    video.setAttribute("playsinline", "")
    video.setAttribute("webkit-playsinline", "")

    const hidePoster = () => {
      setPosterHidden(true)
      video.removeAttribute("poster")
    }

    const tryPlay = () => {
      if (!active) return
      void video.play().then(() => hidePoster()).catch(() => {})
    }

    const onReady = () => tryPlay()
    const onPlaying = () => hidePoster()

    video.addEventListener("playing", onPlaying)

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && active) {
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            tryPlay()
          } else {
            video.addEventListener("loadeddata", onReady, { once: true })
            video.load()
          }
        } else {
          video.pause()
        }
      },
      { threshold: 0.1, rootMargin: "120px 0px" }
    )

    observer.observe(container)
    tryPlay()

    return () => {
      observer.disconnect()
      video.removeEventListener("loadeddata", onReady)
      video.removeEventListener("playing", onPlaying)
    }
  }, [active, src])

  return (
    <div ref={containerRef} className="absolute inset-0 h-full w-full [transform:translateZ(0)]">
      <video
        ref={ref}
        src={src}
        poster={posterHidden ? undefined : poster}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        aria-label={label}
        className={cn("h-full w-full object-cover object-top", className)}
      />
    </div>
  )
}
