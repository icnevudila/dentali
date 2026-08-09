import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type EmptyStateProps = {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

/**
 * Shared empty-state for dashboard modules.
 * Always light clinic chrome — never OS-dark navy blotches.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      data-empty-state="light"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-6 py-14 text-center text-neutral-700 animate-fade-rise",
        className
      )}
    >
      {Icon ? (
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 text-neutral-400">
          <Icon className="h-6 w-6" aria-hidden />
        </div>
      ) : null}
      <div className="max-w-md space-y-1">
        <h3 className="text-sm font-medium text-neutral-800">{title}</h3>
        {description ? <p className="text-sm text-neutral-500">{description}</p> : null}
      </div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
