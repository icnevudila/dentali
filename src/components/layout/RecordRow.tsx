import type { CSSProperties, ReactNode } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { avatarToneClass } from "@/lib/ui/avatar-tone"

type RecordRowProps = {
  href?: string
  transitionTypes?: string[]
  onClick?: () => void
  initials?: string
  leading?: ReactNode
  avatarClassName?: string
  primary: ReactNode
  secondary?: ReactNode
  meta?: ReactNode
  trailing?: ReactNode
  className?: string
  /** List index for staggered enter animation */
  staggerIndex?: number
}

export function RecordRow({
  href,
  transitionTypes,
  onClick,
  initials,
  leading,
  avatarClassName,
  primary,
  secondary,
  meta,
  trailing,
  className,
  staggerIndex,
}: RecordRowProps) {
  const hasLeading = Boolean(leading || initials)

  const inner = (
    <div className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
      {hasLeading ? (
        <div className="row-span-2 sm:row-span-1 self-start sm:self-center">
          {leading ? (
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                avatarClassName ?? "bg-primary-50 text-primary-600"
              )}
              aria-hidden
            >
              {leading}
            </div>
          ) : (
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                avatarToneClass(initials ?? "?"),
                avatarClassName
              )}
              aria-hidden
            >
              {initials}
            </div>
          )}
        </div>
      ) : null}

      <div className={cn("min-w-0", hasLeading ? "col-start-2" : "col-start-1")}>
        <div className="font-medium leading-snug text-neutral-950">{primary}</div>
        {secondary ? (
          <div className="mt-0.5 text-sm leading-snug text-neutral-500">{secondary}</div>
        ) : null}
        {meta ? <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>

      {trailing || href ? (
        <div
          className={cn(
            "flex min-w-0 items-center justify-end gap-2",
            hasLeading ? "col-start-2 sm:col-start-3" : "col-start-1 sm:col-start-2",
            "sm:row-start-1 sm:self-center",
            meta ? "mt-1 sm:mt-0" : "mt-2 sm:mt-0"
          )}
        >
          {trailing}
          {href ? (
            <ChevronRight
              className="h-4 w-4 shrink-0 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-400"
              aria-hidden
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )

  const rowClass = cn(
    "group block w-full rounded-xl border border-neutral-200/90 bg-white px-3.5 py-3 sm:px-4 sm:py-3.5 transition-[border-color,background-color,box-shadow,transform] duration-200",
    staggerIndex !== undefined && "animate-stagger-item",
    href &&
      "hover:border-primary-200 hover:bg-primary-50/20 hover:shadow-[0_2px_12px_rgba(13,148,136,0.07)] active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30",
    className
  )

  const style =
    staggerIndex !== undefined
      ? ({ "--stagger-index": Math.min(staggerIndex, 12) } as CSSProperties)
      : undefined

  if (href) {
    return (
      <Link
        href={href}
        transitionTypes={transitionTypes}
        className={rowClass}
        style={style}
        onClick={onClick}
      >
        {inner}
      </Link>
    )
  }

  return (
    <div
      className={rowClass}
      style={style}
      role={onClick ? "button" : undefined}
      onClick={onClick}
    >
      {inner}
    </div>
  )
}

export function patientInitials(firstName: string, lastName: string): string {
  const a = firstName.trim()[0] ?? ""
  const b = lastName.trim()[0] ?? ""
  const initials = `${a}${b}`.toUpperCase()
  return initials || "?"
}
