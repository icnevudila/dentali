import type { ReactNode } from "react"
import { ViewTransition } from "react"
import { cn } from "@/lib/utils"

type DirectionalTransitionProps = {
  children: ReactNode
  className?: string
}

/** Page-level enter/exit for hierarchical navigation (list → detail). */
export function DirectionalTransition({ children, className }: DirectionalTransitionProps) {
  return (
    <ViewTransition
      enter={{
        "nav-forward": "nav-forward",
        "nav-back": "nav-back",
        default: "none",
      }}
      exit={{
        "nav-forward": "nav-forward",
        "nav-back": "nav-back",
        default: "none",
      }}
      default="none"
    >
      <div className={cn("animate-page-enter min-w-0 max-w-full overflow-x-hidden", className)}>
        {children}
      </div>
    </ViewTransition>
  )
}
