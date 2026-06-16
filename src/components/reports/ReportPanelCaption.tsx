import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type ReportPanelCaptionProps = {
  title: ReactNode
  description: ReactNode
  children: ReactNode
  className?: string
}

export function ReportPanelCaption({
  title,
  description,
  children,
  className,
}: ReportPanelCaptionProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="min-w-0">{children}</div>
      <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/80 px-4 py-3">
        <p className="text-sm font-semibold text-neutral-900">{title}</p>
        <p className="mt-1 text-sm leading-6 text-neutral-600">{description}</p>
      </div>
    </div>
  )
}
