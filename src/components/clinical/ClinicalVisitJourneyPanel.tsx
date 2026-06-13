"use client"

import Link from "next/link"
import { CheckCircle2, Circle, CircleDot, ChevronRight } from "lucide-react"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { ClinicalVisitJourney, ClinicalVisitStep } from "@/lib/clinical/clinical-visit-journey"
import { cn } from "@/lib/utils"

function StepIcon({ status }: { status: ClinicalVisitStep["status"] }) {
  if (status === "done") {
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
  }
  if (status === "current") {
    return <CircleDot className="h-4 w-4 shrink-0 text-primary-600" aria-hidden />
  }
  return <Circle className="h-4 w-4 shrink-0 text-neutral-300" aria-hidden />
}

type ClinicalVisitJourneyPanelProps = {
  journey: ClinicalVisitJourney
  compact?: boolean
}

export function ClinicalVisitJourneyPanel({ journey, compact = false }: ClinicalVisitJourneyPanelProps) {
  const { steps, percentComplete, nextStep, phaseLabel } = journey

  if (compact) {
    return (
      <ContentPanel className="border-neutral-200/80">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-neutral-900">Clinic journey</p>
            <p className="text-xs text-neutral-500 mt-0.5">{phaseLabel} · {percentComplete}% complete</p>
          </div>
          {nextStep ? (
            <Button size="sm" asChild className="gap-1">
              <Link href={nextStep.href ?? "#"}>
                {nextStep.label}
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : (
            <Badge variant="success">Complete</Badge>
          )}
        </div>
      </ContentPanel>
    )
  }

  return (
    <ContentPanel className="border-primary-200/60 bg-gradient-to-br from-primary-50/30 to-white">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-neutral-950">A→Z clinic journey</p>
          <p className="mt-0.5 text-sm text-neutral-600">{phaseLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums text-primary-700">{percentComplete}%</p>
          <p className="text-xs text-neutral-500">of visit path</p>
        </div>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
        <div
          className="h-full rounded-full bg-primary-500 transition-all duration-500"
          style={{ width: `${percentComplete}%` }}
        />
      </div>

      {nextStep ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-primary-200/80 bg-white/80 px-3 py-2.5">
          <span className="text-xs font-medium uppercase tracking-wide text-primary-700">Next</span>
          <span className="text-sm font-medium text-neutral-900">{nextStep.label}</span>
          <span className="text-sm text-neutral-500 hidden sm:inline">— {nextStep.description}</span>
          {nextStep.href ? (
            <Button size="sm" className="ml-auto gap-1" asChild>
              <Link href={nextStep.href}>
                Continue
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      <ol className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step) => (
          <li
            key={step.id}
            className={cn(
              "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
              step.status === "current"
                ? "border-primary-300 bg-primary-50/50"
                : step.status === "done"
                  ? "border-emerald-200/80 bg-emerald-50/30"
                  : "border-neutral-200/80 bg-white/60"
            )}
          >
            <StepIcon status={step.status} />
            <div className="min-w-0 flex-1">
              {step.href && step.status !== "done" ? (
                <Link href={step.href} className="font-medium text-primary-700 hover:underline">
                  {step.label}
                </Link>
              ) : (
                <p className="font-medium text-neutral-900">{step.label}</p>
              )}
              <p className="text-xs text-neutral-500 line-clamp-2">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </ContentPanel>
  )
}
