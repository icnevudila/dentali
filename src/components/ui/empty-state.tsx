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
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-neutral-700",
        className
      )}
    >
      {Icon ? (
        <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-white text-neutral-400 ring-1 ring-neutral-200">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
      ) : null}
      <div className="max-w-md space-y-0.5">
        <h3 className="text-sm font-medium text-neutral-800">{title}</h3>
        {description ? <p className="text-sm text-neutral-500">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}
