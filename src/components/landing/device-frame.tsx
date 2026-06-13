import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import type { DeviceVariant } from "./mock-data"

type DeviceFrameProps = {
  variant: DeviceVariant
  label?: string
  children: ReactNode
  className?: string
  compact?: boolean
  elevated?: boolean
}

const VARIANT_STYLES: Record<
  DeviceVariant,
  { shell: string; screen: string; notch?: boolean; label: string }
> = {
  desktop: {
    shell:
      "rounded-[14px] border border-neutral-700/80 bg-gradient-to-b from-neutral-700 to-neutral-900 p-2 shadow-[0_32px_64px_-20px_rgba(15,23,42,0.45),0_0_0_1px_rgba(255,255,255,0.06)_inset]",
    screen:
      "aspect-[16/10] min-h-[220px] w-full overflow-hidden rounded-[10px] bg-white ring-1 ring-black/5",
    label: "Web admin",
  },
  tablet: {
    shell:
      "rounded-[1.35rem] border border-neutral-800 bg-neutral-950 p-2 shadow-[0_28px_56px_-16px_rgba(15,23,42,0.5)]",
    screen:
      "aspect-[3/4] min-h-[280px] w-full max-w-[280px] overflow-hidden rounded-[1.1rem] bg-white ring-1 ring-white/10",
    notch: true,
    label: "Tablet kiosk",
  },
  mobile: {
    shell:
      "rounded-[2rem] border border-neutral-900 bg-neutral-950 p-1.5 shadow-[0_24px_48px_-12px_rgba(15,23,42,0.55)]",
    screen:
      "aspect-[9/19] min-h-[320px] w-full max-w-[200px] overflow-hidden rounded-[1.5rem] bg-white ring-1 ring-white/10",
    notch: true,
    label: "Mobile preview",
  },
  tv: {
    shell:
      "rounded-xl border border-neutral-900 bg-neutral-950 p-2.5 shadow-[0_32px_64px_-20px_rgba(15,23,42,0.55)]",
    screen:
      "aspect-video min-h-[180px] w-full overflow-hidden rounded-md bg-neutral-950 ring-1 ring-white/5",
    label: "Queue TV",
  },
}

export function DeviceFrame({
  variant,
  label,
  children,
  className,
  compact,
  elevated,
}: DeviceFrameProps) {
  const styles = VARIANT_STYLES[variant]
  const displayLabel = label ?? styles.label

  return (
    <figure className={cn("flex flex-col items-center gap-3", className)}>
      <div
        className={cn(
          styles.shell,
          compact && "origin-center scale-[0.92]",
          elevated && "ring-4 ring-primary-500/10"
        )}
      >
        {variant === "desktop" ? (
          <div className="mb-2 flex items-center gap-1.5 px-1" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            <span className="ml-2 h-1.5 flex-1 max-w-[120px] rounded-full bg-white/10" />
          </div>
        ) : null}
        <div className={cn("relative", styles.screen)}>
          {styles.notch ? (
            <div
              className="pointer-events-none absolute left-1/2 top-0 z-10 h-5 w-[72px] -translate-x-1/2 rounded-b-2xl bg-neutral-950"
              aria-hidden
            />
          ) : null}
          <div className="landing-preview-vignette pointer-events-none absolute inset-0 z-[1]" aria-hidden />
          {children}
        </div>
        {variant === "tv" ? (
          <div className="mx-auto mt-2.5 flex flex-col items-center gap-1" aria-hidden>
            <div className="h-1 w-20 rounded-full bg-neutral-800" />
            <div className="h-2 w-32 rounded-sm bg-neutral-800/80" />
          </div>
        ) : null}
      </div>
      {displayLabel ? (
        <figcaption className="text-center text-[11px] font-medium tracking-wide text-neutral-500">
          {displayLabel}
        </figcaption>
      ) : null}
    </figure>
  )
}

export function DeviceFrameRow({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-center gap-8 sm:gap-10 lg:gap-12",
        className
      )}
    >
      {children}
    </div>
  )
}
