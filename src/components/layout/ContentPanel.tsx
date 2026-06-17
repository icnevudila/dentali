import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function ContentPanel({
  children,
  className,
  padding = "default",
}: {
  children: ReactNode
  className?: string
  padding?: "none" | "default" | "lg"
}) {
  return (
    <div
      className={cn(
        "min-w-0 max-w-full rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.03)]",
        padding === "default" && "p-4 sm:p-5",
        padding === "lg" && "p-6 sm:p-8",
        padding === "none" && "p-0",
        className
      )}
    >
      {children}
    </div>
  )
}
