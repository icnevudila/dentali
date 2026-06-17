import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { SectionEyebrow } from "@/components/layout/SectionEyebrow"
import { cn } from "@/lib/utils"

type ReportsSectionBlockProps = {
  icon: LucideIcon
  eyebrow: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  id?: string
}

export function ReportsSectionBlock({
  icon,
  eyebrow,
  title,
  description,
  action,
  children,
  className,
  id,
}: ReportsSectionBlockProps) {
  return (
    <section
      id={id}
      className={cn(
        "min-w-0 max-w-full space-y-3 scroll-mt-20 rounded-2xl transition-colors target:bg-primary-50/35 target:ring-1 target:ring-primary-200",
        className
      )}
    >
      <SectionEyebrow icon={icon}>{eyebrow}</SectionEyebrow>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between min-w-0">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold text-neutral-950">{title}</h2>
          {description ? <p className="max-w-3xl text-sm text-neutral-500">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  )
}
