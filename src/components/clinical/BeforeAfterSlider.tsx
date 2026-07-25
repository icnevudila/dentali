"use client"

import { useState, useRef, useCallback } from "react"
import { Sparkles, MoveHorizontal } from "lucide-react"

interface BeforeAfterSliderProps {
  beforeImage: string
  afterImage: string
  beforeLabel?: string
  afterLabel?: string
  aspectRatio?: string
  className?: string
}

export function BeforeAfterSlider({
  beforeImage,
  afterImage,
  beforeLabel = "Tedavi Öncesi",
  afterLabel = "Tedavi Sonrası",
  className = "",
}: BeforeAfterSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMove = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = clientX - rect.left
      let percentage = (x / rect.width) * 100
      if (percentage < 0) percentage = 0
      if (percentage > 100) percentage = 100
      setSliderPosition(percentage)
    },
    []
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return
      handleMove(e.touches[0].clientX)
    },
    [isDragging, handleMove]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return
      handleMove(e.clientX)
    },
    [isDragging, handleMove]
  )

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950 select-none ${className}`}
      onMouseDown={() => setIsDragging(true)}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
      onMouseMove={handleMouseMove}
      onTouchStart={() => setIsDragging(true)}
      onTouchEnd={() => setIsDragging(false)}
      onTouchMove={handleTouchMove}
    >
      {/* After Image (Background / Full Width) */}
      <div className="relative w-full h-[400px] sm:h-[480px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={afterImage}
          alt={afterLabel}
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute top-4 right-4 z-10 inline-flex items-center gap-1.5 rounded-full bg-emerald-600/90 backdrop-blur-md px-3 py-1 text-xs font-bold text-white shadow-lg">
          <Sparkles className="h-3.5 w-3.5" />
          <span>{afterLabel}</span>
        </div>

        {/* Before Image (Clipped overlay) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${sliderPosition}%` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={beforeImage}
            alt={beforeLabel}
            className="absolute inset-0 w-full h-full object-cover object-center"
            style={{
              width: containerRef.current ? `${containerRef.current.clientWidth}px` : "100%",
              maxWidth: "none",
            }}
          />
          <div className="absolute top-4 left-4 z-10 inline-flex items-center gap-1.5 rounded-full bg-slate-900/90 backdrop-blur-md px-3 py-1 text-xs font-bold text-slate-200 shadow-lg">
            <span>{beforeLabel}</span>
          </div>
        </div>

        {/* Divider Slider Handle */}
        <div
          className="absolute top-0 bottom-0 z-20 w-1 bg-white cursor-ew-resize shadow-[0_0_12px_rgba(0,0,0,0.5)]"
          style={{ left: `${sliderPosition}%` }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-900 shadow-xl border-2 border-teal-500 transition-transform active:scale-95">
            <MoveHorizontal className="h-4 w-4" />
          </div>
        </div>
      </div>
    </div>
  )
}
