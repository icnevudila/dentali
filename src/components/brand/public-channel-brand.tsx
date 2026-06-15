"use client"

import { DentQLLogo } from "@/components/brand/dentql-logo"
import { cn } from "@/lib/utils"

type PublicChannelBrandProps = {
  /** Fixed top bar on kiosk / portal surfaces */
  variant?: "header" | "hero" | "screensaver"
  /** Optional label beside logo (e.g. Portal) */
  suffix?: string
  className?: string
}

const logoPlate =
  "rounded-2xl border border-white/80 bg-white/92 shadow-sm ring-1 ring-neutral-200/35 backdrop-blur-sm"

export function PublicChannelBrand({
  variant = "hero",
  suffix,
  className,
}: PublicChannelBrandProps) {
  if (variant === "header") {
    return (
      <div className={cn("absolute left-0 right-0 top-5 z-20 flex justify-center px-4", className)}>
        <div
          className={cn(
            "inline-flex items-center gap-2.5 px-4 py-2",
            logoPlate,
            "rounded-full"
          )}
        >
          <DentQLLogo variant="compact" size="sm" />
          {suffix ? (
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-400">
              {suffix}
            </span>
          ) : null}
        </div>
      </div>
    )
  }

  if (variant === "screensaver") {
    return (
      <div className={cn("px-6 py-5", logoPlate, "rounded-3xl shadow-lg ring-white/20", className)}>
        <DentQLLogo variant="compact" size="lg" />
      </div>
    )
  }

  return (
    <div className={cn("mx-auto w-fit px-5 py-4", logoPlate, className)}>
      <DentQLLogo variant="compact" size="md" />
    </div>
  )
}
