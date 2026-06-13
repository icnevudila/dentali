import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

export type PipelineStep = {
  id: string
  label: string
  /** completed | current | upcoming */
  state: "completed" | "current" | "upcoming"
}

export function StatusPipeline({
  steps,
  className,
  compact,
}: {
  steps: PipelineStep[]
  className?: string
  compact?: boolean
}) {
  if (steps.length === 0) return null

  return (
    <div
      className={cn("flex items-center gap-0", compact ? "gap-0" : "gap-0", className)}
      role="list"
      aria-label="Progress"
    >
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1
        return (
          <div key={step.id} className="flex min-w-0 flex-1 items-center" role="listitem">
            <div className="flex min-w-0 flex-col items-center gap-1">
              <span
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  compact ? "h-5 w-5" : "h-6 w-6",
                  step.state === "completed" &&
                    "border-primary-500 bg-primary-500 text-white",
                  step.state === "current" &&
                    "border-primary-500 bg-primary-50 text-primary-700",
                  step.state === "upcoming" &&
                    "border-neutral-200 bg-white text-neutral-300"
                )}
                aria-hidden
              >
                {step.state === "completed" ? (
                  <Check className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} strokeWidth={3} />
                ) : (
                  <span
                    className={cn(
                      "rounded-full bg-current",
                      compact ? "h-1.5 w-1.5" : "h-2 w-2",
                      step.state === "current" && "bg-primary-500",
                      step.state === "upcoming" && "bg-neutral-300"
                    )}
                  />
                )}
              </span>
              {!compact ? (
                <span
                  className={cn(
                    "max-w-[4.5rem] truncate text-center text-[10px] font-medium leading-tight sm:max-w-none sm:text-xs",
                    step.state === "completed" && "text-primary-700",
                    step.state === "current" && "text-neutral-950",
                    step.state === "upcoming" && "text-neutral-400"
                  )}
                >
                  {step.label}
                </span>
              ) : null}
            </div>
            {!isLast ? (
              <div
                className={cn(
                  "mx-1 h-0.5 min-w-[12px] flex-1 rounded-full",
                  step.state === "completed" ? "bg-primary-400" : "bg-neutral-200"
                )}
                aria-hidden
              />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

/** Map consent / waitlist / HMO status strings to pipeline steps */
export function consentPipelineSteps(status: "pending" | "signed" | "voided"): PipelineStep[] {
  if (status === "voided") {
    return [
      { id: "draft", label: "Draft", state: "completed" },
      { id: "voided", label: "Voided", state: "current" },
    ]
  }
  if (status === "signed") {
    return [
      { id: "review", label: "Review", state: "completed" },
      { id: "sign", label: "Signed", state: "completed" },
      { id: "filed", label: "Filed", state: "completed" },
    ]
  }
  return [
    { id: "review", label: "Review", state: "current" },
    { id: "sign", label: "Sign", state: "upcoming" },
    { id: "filed", label: "Filed", state: "upcoming" },
  ]
}

export function waitlistPipelineSteps(
  status: "waiting" | "contacted" | "booked" | "cancelled" | "expired"
): PipelineStep[] {
  const order = ["waiting", "contacted", "booked"] as const
  const idx = order.indexOf(status as (typeof order)[number])
  if (idx === -1) {
    return [
      { id: "waiting", label: "Waiting", state: "completed" },
      { id: "done", label: status === "cancelled" ? "Cancelled" : "Expired", state: "current" },
    ]
  }
  return order.map((id, i) => ({
    id,
    label: id === "waiting" ? "Waiting" : id === "contacted" ? "Contacted" : "Booked",
    state: i < idx ? "completed" : i === idx ? "current" : "upcoming",
  }))
}
