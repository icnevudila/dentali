import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function SectionEyebrow({
  children,
  icon: Icon,
  className,
  hideOnMobile = false,
}: {
  children: ReactNode
  icon?: LucideIcon
  className?: string
  hideOnMobile?: boolean
}) {
  return (
    <div className={cn("flex items-center gap-2", hideOnMobile && "hidden md:flex", className)}>
      {Icon ? (
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-50 text-primary-600">
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
      ) : null}
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">{children}</p>
    </div>
  )
}
