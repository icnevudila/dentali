"use client"

import Link from "next/link"
import { ArrowRight, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/use-locale"
import type { CarryForwardSources } from "@/lib/clinical/encounter-carry-forward"

type EncounterCarryForwardBannerProps = {
  patientId: string
  sources: CarryForwardSources
  onApplyNote?: () => void
  onApplyPlan?: () => void
}

export function EncounterCarryForwardBanner({
  patientId,
  sources,
  onApplyNote,
  onApplyPlan,
}: EncounterCarryForwardBannerProps) {
  const { t } = useLocale()
  const { note, plan } = sources

  if (!note && !plan) return null

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/60 px-4 py-3 text-sm text-sky-950 animate-fade-rise">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-2 min-w-0">
          <History className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
          <div className="min-w-0 space-y-1">
            <p className="font-medium">
              {t("visits.carryForwardTitle", "Carry forward from last visit")}
            </p>
            <p className="text-xs text-sky-900/80">
              {note
                ? t(
                    "visits.carryForwardNoteHint",
                    "Previous note {title} from {code} can pre-fill today's SOAP."
                  )
                    .replace("{title}", note.title)
                    .replace("{code}", note.sourceLabel)
                : null}
              {note && plan ? " · " : null}
              {plan
                ? t(
                    "visits.carryForwardPlanHint",
                    "Plan {title} ({count} items) from {code}."
                  )
                    .replace("{title}", plan.title)
                    .replace("{count}", String(plan.itemCount))
                    .replace("{code}", plan.sourceLabel)
                : null}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {note ? (
            onApplyNote ? (
              <Button size="sm" variant="outline" className="gap-1 bg-white" onClick={onApplyNote}>
                {t("visits.carryForwardApplyNote", "Use prior SOAP")}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="gap-1 bg-white" asChild>
                <Link href={`/patients/${patientId}?tab=clinical-notes`}>
                  {t("visits.carryForwardApplyNote", "Use prior SOAP")}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )
          ) : null}
          {plan ? (
            <Button size="sm" variant="outline" className="gap-1 bg-white" asChild>
              <Link href={`/patients/${patientId}/treatment-plan`}>
                {t("visits.carryForwardViewPlan", "View prior plan")}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
