"use client"

import Link from "next/link"
import { Activity, ExternalLink } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/use-locale"

/**
 * Chart-page entry to the dedicated perio route.
 * Avoids embedding a second editable pocket grid next to `/patients/[id]/perio`.
 */
export function PeriodontalChartPanel({
  patientId,
}: {
  patientId: string
  /** @deprecated unused — kept for call-site compatibility */
  branchId?: string
  organizationId?: string | null
  actorUserId?: string | null
  canWrite?: boolean
  selectedTooth?: number | null
  onSelectTooth?: (tooth: number) => void
  defaultCollapsed?: boolean
}) {
  const { t } = useLocale()

  return (
    <Card data-testid="periodontal-chart-panel" className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Activity className="h-4 w-4 text-neutral-500" />
          {t("patients.perioChartLinkTitle", "Periodontics")}
        </CardTitle>
        <CardDescription className="text-xs">
          {t(
            "patients.perioChartLinkDescription",
            "Pocket depths and BOP live on the dedicated periodontal chart — open it to edit or restore history."
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 pb-4">
        <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
          <Link href={`/patients/${patientId}/perio`}>
            {t("patients.perioChartLinkCta", "Open periodontal chart")}
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
