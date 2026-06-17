"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type HorizontalSnapStripProps = {
  children: React.ReactNode
  className?: string
  itemClassName?: string
  /** Tailwind breakpoint where horizontal scroll becomes a static grid/flex column */
  desktopLayout?: "grid" | "flex-col"
  desktopCols?: 2 | 3 | 4 | 5 | 6
}

export function HorizontalSnapStrip({
  children,
  className,
  itemClassName,
  desktopLayout = "grid",
  desktopCols = 4,
}: HorizontalSnapStripProps) {
  const desktopGrid =
    desktopCols === 2
      ? "lg:grid-cols-2"
      : desktopCols === 3
        ? "lg:grid-cols-3"
        : desktopCols === 5
          ? "lg:grid-cols-5"
          : desktopCols === 6
            ? "lg:grid-cols-6"
            : "lg:grid-cols-4"

  return (
    <div
      className={cn(
        "w-full min-w-0",
        "-mx-1 flex gap-4 overflow-x-auto px-1 pb-2 snap-x snap-mandatory scroll-px-4",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        desktopLayout === "grid"
          ? cn("lg:mx-0 lg:grid lg:gap-4 lg:overflow-visible lg:px-0 lg:pb-0 lg:snap-none", desktopGrid)
          : "lg:mx-0 lg:flex lg:flex-col lg:gap-4 lg:overflow-visible lg:px-0 lg:pb-0 lg:snap-none",
        className
      )}
    >
      {React.Children.map(children, (child) => (
        <div
          className={cn(
            "min-w-[min(88vw,360px)] shrink-0 snap-start sm:min-w-[320px] lg:min-w-0 lg:shrink",
            itemClassName
          )}
        >
          {child}
        </div>
      ))}
    </div>
  )
}
