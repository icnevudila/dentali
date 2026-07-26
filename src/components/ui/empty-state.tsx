import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

type EmptyStateProps = {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

/** Shared empty-state block for list/module surfaces. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-12 dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {Icon ? (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
          <Icon className="h-6 w-6" aria-hidden />
        </div>
      ) : null}
      <div className="space-y-1 max-w-md">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        {description ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}
