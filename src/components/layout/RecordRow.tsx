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
  avatarUrl?: string | null
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
  avatarUrl,
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
    <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full min-w-0 gap-4">
      <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
        {hasLeading && (
          leading ? (
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                avatarClassName ?? "bg-primary-50 text-primary-600"
              )}
              aria-hidden
            >
              {leading}
            </div>
          ) : avatarUrl ? (
            <img 
              src={avatarUrl} 
              alt={initials ?? ""} 
              className={cn("h-11 w-11 shrink-0 rounded-full object-cover", avatarClassName)}
              aria-hidden
            />
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
          )
        )}
        <div className="min-w-0 flex-1">
          <div className="font-semibold leading-snug text-neutral-950 text-sm sm:text-base">{primary}</div>
          {secondary ? (
            <div className="mt-0.5 text-xs sm:text-sm leading-snug text-neutral-500 break-words">{secondary}</div>
          ) : null}
          {meta ? <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div> : null}
        </div>
      </div>

      {(trailing || href || onClick) && (
        <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 border-t border-neutral-100 sm:border-0 pt-3 sm:pt-0">
          {trailing}
          {href || onClick ? (
            <ChevronRight
              className="h-4 w-4 shrink-0 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-400"
              aria-hidden
            />
          ) : null}
        </div>
      )}
    </div>
  )

  const rowClass = cn(
    "group block w-full rounded-xl border border-neutral-200/90 bg-white px-3.5 py-3 sm:px-4 sm:py-3.5 transition-[border-color,background-color,box-shadow,transform] duration-200",
    staggerIndex !== undefined && "animate-stagger-item",
    (href || onClick) &&
      "cursor-pointer hover:border-primary-200 hover:bg-primary-50/20 hover:shadow-[0_2px_12px_rgba(13,148,136,0.07)] active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30",
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
        onClick={(e) => {
          const target = e.target as HTMLElement
          if (target.closest("button, input, select, textarea, label")) {
            e.preventDefault()
            return
          }
          const nestedLink = target.closest("a[href]")
          if (nestedLink && nestedLink !== e.currentTarget) {
            return
          }
          onClick?.()
        }}
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
      tabIndex={onClick ? 0 : undefined}
      onClick={(e) => {
        const target = e.target as HTMLElement
        if (target.closest("button, a[href], input, select, textarea, label")) {
          return
        }
        onClick?.()
      }}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
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
