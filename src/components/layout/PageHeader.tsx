import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type PageHeaderProps = {
  title: ReactNode
  description?: ReactNode
  eyebrow?: ReactNode
  actions?: ReactNode
  className?: string
  /** Shorter title and hide description on small screens */
  compact?: boolean
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
  compact = false,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4",
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-600/90">{eyebrow}</p>
        ) : null}
        <h1
          className={cn(
            "font-bold tracking-tight text-neutral-950",
            compact ? "text-xl sm:text-2xl" : "text-2xl"
          )}
        >
          {title}
        </h1>
        {description ? (
          <div className={cn("text-sm text-neutral-500", compact && "hidden sm:block")}>{description}</div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full min-w-0 flex-wrap items-stretch gap-2 sm:w-auto sm:items-center print:hidden [&_a]:max-w-full [&_button]:max-w-full">
          {actions}
        </div>
      ) : null}
    </div>
  )
}
