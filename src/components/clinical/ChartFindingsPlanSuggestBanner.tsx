"use client"

import Link from "next/link"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ToothFinding } from "@/lib/types/dental"
import { useLocale } from "@/hooks/use-locale"

function countSuggestableFindings(findings: ToothFinding[]): number {
  return findings.filter(
    (f) =>
      f.status === "active" &&
      ((f.condition && f.condition !== "present") ||
        Boolean(f.restoration_type) ||
        Boolean(f.surgery_type))
  ).length
}

type ChartFindingsPlanSuggestBannerProps = {
  patientId: string
  findings: ToothFinding[]
}

export function ChartFindingsPlanSuggestBanner({
  patientId,
  findings,
}: ChartFindingsPlanSuggestBannerProps) {
  const { t } = useLocale()
  const count = countSuggestableFindings(findings)

  if (count === 0) return null

  return (
    <Card className="border-primary-200 bg-primary-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-primary-900">
          <Sparkles className="h-4 w-4" />
          {t("chart.planSuggestTitle", "Plan from chart")}
        </CardTitle>
        <CardDescription>
          {count}{" "}
          {t(
            "chart.planSuggestDescription",
            "chart finding(s) can be added to a treatment plan as matched procedures."
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="default" size="sm" asChild className="gap-2">
          <Link href={`/patients/${patientId}/treatment-plan`}>
            <Sparkles className="h-4 w-4" />
            {t("chart.planSuggestCta", "Open treatment plan")}
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
