"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLocale } from "@/hooks/use-locale"

export type ConsentSigningStep = "read" | "complete" | "sign"

const STEPS: ConsentSigningStep[] = ["read", "complete", "sign"]

export function ConsentSigningSteps({
  active,
  className,
}: {
  active: ConsentSigningStep
  className?: string
}) {
  const { t } = useLocale()
  const labels: Record<ConsentSigningStep, string> = {
    read: t("consent.stepRead", "Read"),
    complete: t("consent.stepComplete", "Complete"),
    sign: t("consent.stepSign", "Sign"),
  }
  const activeIndex = STEPS.indexOf(active)

  return (
    <ol
      className={cn("flex items-center justify-center gap-1 sm:gap-2", className)}
      aria-label={t("consent.signingProgress", "Signing progress")}
    >
      {STEPS.map((step, index) => {
        const done = index < activeIndex
        const current = index === activeIndex
        return (
          <li key={step} className="flex items-center gap-1 sm:gap-2">
            {index > 0 ? (
              <span
                className={cn(
                  "hidden h-px w-4 sm:block sm:w-8",
                  done ? "bg-primary-400" : "bg-neutral-200"
                )}
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors sm:px-3 sm:text-xs",
                done && "border-primary-200 bg-primary-50 text-primary-800",
                current && "border-primary-300 bg-white text-primary-900 shadow-sm ring-1 ring-primary-100",
                !done && !current && "border-neutral-200 bg-neutral-50 text-neutral-500"
              )}
              aria-current={current ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full text-[10px]",
                  done && "bg-primary-600 text-white",
                  current && "bg-primary-100 text-primary-700",
                  !done && !current && "bg-neutral-200 text-neutral-500"
                )}
              >
                {done ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : index + 1}
              </span>
              <span className="hidden sm:inline">{labels[step]}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
