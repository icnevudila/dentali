"use client"

import * as React from "react"
import Link from "next/link"
import { Sparkles, Stethoscope } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getPatientOdontogram } from "@/lib/odontogram/dental-chart-service"
import { BulletTextList } from "@/components/ui/BulletTextList"
import {
  buildChartFindingSuggestions,
  type ChartFindingSuggestion,
  type ProcedureLike,
} from "@/lib/clinical/chart-finding-suggestions"

type ChartFindingSuggestionsCardProps = {
  patientId: string
  branchId: string | null
  procedures: ProcedureLike[]
  planItems: { tooth_number?: string | null; description: string }[]
  onAddAll: () => void
  saving: boolean
  disabled?: boolean
}

export function ChartFindingSuggestionsCard({
  patientId,
  branchId,
  procedures,
  planItems,
  onAddAll,
  saving,
  disabled,
}: ChartFindingSuggestionsCardProps) {
  const [suggestions, setSuggestions] = React.useState<ChartFindingSuggestion[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (!branchId) {
      setSuggestions([])
      setLoading(false)
      return
    }

    setLoading(true)
    getPatientOdontogram(patientId, branchId).then(({ data }) => {
      const findings = data?.findings ?? []
      setSuggestions(buildChartFindingSuggestions(findings, procedures, planItems))
      setLoading(false)
    })
  }, [patientId, branchId, procedures, planItems])

  if (loading) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 text-sm text-neutral-500">Loading chart suggestions…</CardContent>
      </Card>
    )
  }

  if (suggestions.length === 0) {
    return null
  }

  const unmatched = suggestions.filter((s) => !s.procedureId).length
  const needsPricing = suggestions.filter((s) => s.procedureId).length

  return (
    <Card className="border-primary-200/80 bg-primary-50/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-primary-600" />
          Suggested from chart findings
        </CardTitle>
        <CardDescription>
          {suggestions.length} finding{suggestions.length === 1 ? "" : "s"} can be added as plan items.
          {unmatched > 0
            ? ` ${unmatched} need a manual procedure match in the catalog.`
            : null}{" "}
          <Link href={`/patients/${patientId}/chart`} className="text-primary-600 hover:underline">
            Open chart
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="divide-y rounded-md border bg-white text-sm max-h-48 overflow-y-auto">
          {suggestions.map((s) => (
            <li key={s.finding.tooth_number} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <BulletTextList text={s.description} className="text-sm font-medium text-neutral-900" />
                <p className="text-xs text-neutral-500 mt-0.5">Tooth {s.finding.tooth_number}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!s.procedureId ? (
                  <Badge variant="outline" className="text-xs">
                    No catalog match
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-neutral-600">
                    Set price on plan
                  </Badge>
                )}
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-neutral-600">
            {needsPricing > 0
              ? "Prices are not copied from the catalog — set patient-specific amounts on each plan row after adding."
              : "Review matches, then set prices on the plan before approving."}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={disabled || saving}
            onClick={onAddAll}
          >
            <Sparkles className="h-4 w-4" />
            {saving ? "Adding…" : "Add all suggestions"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
