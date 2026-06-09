import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "outline"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "border-transparent bg-neutral-100 text-neutral-900 hover:bg-neutral-200",
    success: "border-transparent bg-success-50 text-success-600",
    warning: "border-transparent bg-warning-50 text-warning-600",
    danger: "border-transparent bg-danger-50 text-danger-600",
    info: "border-transparent bg-info-50 text-info-600",
    outline: "text-neutral-950 border-neutral-200",
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:ring-offset-2",
        variants[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }
