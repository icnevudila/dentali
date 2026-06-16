"use client"

import Link from "next/link"
import { CheckCircle2, Circle, CircleDot, ChevronRight, PartyPopper } from "lucide-react"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useLocale } from "@/hooks/use-locale"
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
  celebrate?: boolean
}

export function ClinicalVisitJourneyPanel({
  journey,
  compact = false,
  celebrate = false,
}: ClinicalVisitJourneyPanelProps) {
  const { t } = useLocale()
  const { steps, percentComplete, nextStep, phaseLabel } = journey
  const isComplete = percentComplete >= 100 || !nextStep
  const showCelebration = isComplete || celebrate

  if (compact) {
    return (
      <ContentPanel className="border-neutral-200/80">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-neutral-900">
              {t("journey.title", "Clinic journey")}
            </p>
            <p className="text-xs text-neutral-500 mt-0.5">
              {phaseLabel} · {percentComplete}% {t("journey.complete", "complete")}
            </p>
          </div>
          {showCelebration ? (
            <Badge variant="success">{t("journey.completeBadge", "Complete")}</Badge>
          ) : nextStep ? (
            <Button size="sm" asChild className="gap-1">
              <Link href={nextStep.href ?? "#"}>
                {nextStep.label}
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : null}
        </div>
      </ContentPanel>
    )
  }

  return (
    <ContentPanel
      className={cn(
        showCelebration
          ? "border-emerald-200/80 bg-gradient-to-br from-emerald-50/40 to-white"
          : "border-primary-200/60 bg-gradient-to-br from-primary-50/30 to-white"
      )}
    >
      {showCelebration ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200/90 bg-emerald-50/80 px-4 py-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <PartyPopper className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-emerald-900">
              {t("journey.pathComplete", "Visit path complete")}
            </p>
            <p className="text-sm text-emerald-800/90">
              {t(
                "journey.pathCompleteHint",
                "Intake, clinical work, and billing milestones are all on file for this patient."
              )}
            </p>
          </div>
          <Badge variant="success" className="shrink-0">
            {t("journey.completeBadge", "Complete")}
          </Badge>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-neutral-950">
            {t("journey.fullTitle", "A→Z clinic journey")}
          </p>
          <p className="mt-0.5 text-sm text-neutral-600">{phaseLabel}</p>
        </div>
        <div className="text-right">
          <p
            className={cn(
              "text-2xl font-bold tabular-nums",
              showCelebration ? "text-emerald-700" : "text-primary-700"
            )}
          >
            {percentComplete}%
          </p>
          <p className="text-xs text-neutral-500">{t("journey.ofVisitPath", "of visit path")}</p>
        </div>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            showCelebration ? "bg-emerald-500" : "bg-primary-500"
          )}
          style={{ width: `${percentComplete}%` }}
        />
      </div>

      {nextStep && !showCelebration ? (
        <div className="mt-4 rounded-xl border-2 border-primary-300/80 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-primary-600">
                {t("journey.nextStep", "Next step")}
              </p>
              <p className="mt-1 text-base font-semibold text-neutral-900">{nextStep.label}</p>
              <p className="mt-0.5 text-sm text-neutral-600">{nextStep.description}</p>
            </div>
            {nextStep.href ? (
              <Button size="lg" className="w-full shrink-0 gap-2 sm:w-auto" asChild>
                <Link href={nextStep.href}>
                  {t("journey.continue", "Continue")}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
          </div>
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
