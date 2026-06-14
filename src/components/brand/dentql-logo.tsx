"use client"

import * as React from "react"
import Link from "next/link"
import { Space_Grotesk } from "next/font/google"
import { cn } from "@/lib/utils"
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand"

const brandFont = Space_Grotesk({ subsets: ["latin"], weight: ["700"] })

export function DentQLMark({
  className,
  size = 40,
}: {
  className?: string
  size?: number
}) {
  const id = React.useId().replace(/:/g, "")
  const glowId = `dentql-glow-${id}`

  return (
    <svg
      width={size}
      height={Math.round(size * 0.9)}
      viewBox="0 0 100 90"
      className={cn("shrink-0", className)}
      role="img"
      aria-label={BRAND_NAME}
    >
      <defs>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(14, 165, 233, 0.2)" />
          <stop offset="100%" stopColor="rgba(14, 165, 233, 0)" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="48" r="38" fill={`url(#${glowId})`} />
      <g transform="translate(26, 6)">
        <g transform="scale(0.12) translate(-260, -120)">
          <path
            d="M 280 250 C 260 120, 360 120, 400 180 C 440 120, 540 120, 520 250 C 500 350, 460 380, 450 420 C 400 390, 400 390, 350 420 C 340 380, 300 350, 280 250 Z"
            fill="rgba(14, 165, 233, 0.05)"
            stroke="#0EA5E9"
            strokeWidth="8"
          />
          <path
            d="M 300 250 C 290 150, 360 150, 400 190 C 440 150, 510 150, 500 250 C 490 330, 460 380, 450 420 C 480 550, 490 680, 450 720 C 420 740, 400 680, 420 580 C 410 500, 390 500, 380 580 C 400 680, 380 740, 350 720 C 310 680, 320 550, 350 420 C 340 380, 310 330, 300 250 Z"
            fill="none"
            stroke="#38BDF8"
            strokeWidth="6"
            strokeDasharray="10 5"
          />
          <path
            d="M 340 280 C 340 220, 380 220, 400 250 C 420 220, 460 220, 460 280 C 460 350, 440 380, 430 420 C 440 550, 450 680, 445 720 L 435 720 C 440 680, 430 580, 430 580 C 425 480, 375 480, 370 580 C 375 680, 365 720, 365 720 L 355 720 C 350 680, 360 550, 370 420 C 360 380, 340 350, 340 280 Z"
            fill="rgba(2, 132, 199, 0.2)"
            stroke="#0284C7"
            strokeWidth="6"
          />
          <path
            d="M 400 260 Q 420 300 415 350 T 435 480 T 440 720"
            stroke="#38BDF8"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      </g>
      <line x1="8" y1="48" x2="72" y2="48" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="8" cy="48" r="2.5" fill="#FFFFFF" />
      <circle cx="72" cy="48" r="2.5" fill="#FFFFFF" />
    </svg>
  )
}

type DentQLLogoProps = {
  variant?: "full" | "compact" | "mark"
  size?: "sm" | "md" | "lg"
  invert?: boolean
  className?: string
  href?: string
}

const MARK_SIZES = { sm: 28, md: 36, lg: 44 } as const
const WORD_SIZES = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
} as const

export function DentQLLogo({
  variant = "compact",
  size = "md",
  invert = false,
  className,
  href,
}: DentQLLogoProps) {
  const markSize = MARK_SIZES[size]
  const content =
    variant === "mark" ? (
      <DentQLMark size={markSize} />
    ) : (
      <div className={cn("flex items-center gap-2.5", className)}>
        <DentQLMark size={markSize} />
        <div className="min-w-0 leading-none">
          <span
            className={cn(
              brandFont.className,
              "font-bold tracking-tight",
              WORD_SIZES[size],
              invert ? "text-white" : "text-slate-900"
            )}
          >
            dent<span className={invert ? "text-sky-200" : "text-sky-500"}>QL</span>
          </span>
          {variant === "full" ? (
            <p
              className={cn(
                "mt-1 text-[9px] font-bold uppercase tracking-[0.32em] sm:text-[10px]",
                invert ? "text-white/65" : "text-slate-400"
              )}
            >
              {BRAND_TAGLINE}
            </p>
          ) : null}
        </div>
      </div>
    )

  if (href) {
    return (
      <Link href={href} className="inline-flex shrink-0 items-center">
        {content}
      </Link>
    )
  }

  return content
}
