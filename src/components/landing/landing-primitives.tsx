import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function LandingEyebrow({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p
      className={cn(
        "text-xs font-semibold uppercase tracking-[0.14em] text-primary-700",
        className
      )}
    >
      {children}
    </p>
  )
}

export function LandingSectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: {
  eyebrow?: string
  title: string
  description?: string
  align?: "left" | "center"
  className?: string
}) {
  return (
    <div
      className={cn(
        align === "center" && "mx-auto max-w-2xl text-center",
        align === "left" && "max-w-2xl",
        className
      )}
    >
      {eyebrow ? <LandingEyebrow>{eyebrow}</LandingEyebrow> : null}
      <h2
        className={cn(
          "font-semibold tracking-tight text-neutral-950",
          eyebrow ? "mt-3" : "",
          align === "center" ? "text-2xl sm:text-3xl" : "text-2xl sm:text-[1.75rem]"
        )}
      >
        {title}
      </h2>
      {description ? (
        <p className="mt-3 text-base leading-relaxed text-neutral-600">{description}</p>
      ) : null}
    </div>
  )
}

export function LandingSection({
  children,
  className,
  tone = "default",
  id,
}: {
  children: ReactNode
  className?: string
  tone?: "default" | "muted" | "inset"
  id?: string
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative",
        tone === "default" && "bg-white",
        tone === "muted" && "landing-surface-muted",
        tone === "inset" && "landing-surface-inset",
        className
      )}
    >
      {children}
    </section>
  )
}

export function LandingShowcaseWell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "landing-showcase-well relative overflow-hidden rounded-2xl border border-neutral-200/80 bg-neutral-50/80 p-3 sm:p-4",
        className
      )}
    >
      <div className="landing-showcase-well-glow pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative">{children}</div>
    </div>
  )
}
