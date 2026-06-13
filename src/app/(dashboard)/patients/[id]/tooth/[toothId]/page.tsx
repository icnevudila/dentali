"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PatientPageShell } from "@/components/patients/PatientPageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useRouteParams } from "@/hooks/use-route-params"
import { useBranch } from "@/hooks/use-branch"
import { getPatientOdontogram } from "@/lib/odontogram/dental-chart-service"
import { getPatient } from "@/lib/patients/patient-service"
import type { ToothFinding } from "@/lib/types/dental"

export default function ToothDetailPage() {
  const { id: patientId, toothId } = useRouteParams<{ id: string; toothId: string }>()
  const { activeBranch } = useBranch()
  const [finding, setFinding] = React.useState<ToothFinding | null>(null)
  const [patientName, setPatientName] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!patientId || !activeBranch) return
    Promise.all([
      getPatientOdontogram(patientId, activeBranch.id),
      getPatient(patientId),
    ]).then(([chart, patient]) => {
      if (chart.error) setError(chart.error)
      const match = chart.data?.findings.find((f) => f.tooth_number === toothId)
      setFinding(match ?? null)
      if (patient.data) {
        setPatientName(`${patient.data.first_name} ${patient.data.last_name}`)
      }
      setLoading(false)
    })
  }, [patientId, toothId, activeBranch])

  if (loading) {
    return <PageLoadingSkeleton variant="detail" className="max-w-5xl px-4 py-8" />
  }

  return (
    <PermissionGate permission={PERMISSIONS.DENTAL_CHART_READ}>
      <PatientPageShell
        patientId={patientId}
        backHref={`/patients/${patientId}/chart`}
        section="Dental chart"
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            Tooth {toothId}
            <Badge variant="default">Permanent</Badge>
          </span>
        }
        description={patientName}
        maxWidth="max-w-5xl"
        className="pb-10"
        error={error}
        badges={
          <Badge variant="outline">
            {finding?.condition ?? finding?.restoration_type ?? "Healthy / No finding"}
          </Badge>
        }
      >
        <Card className="border-0 shadow-none">
          <CardHeader>
            <CardTitle>Clinical Finding</CardTitle>
            <CardDescription>Data from the active dental chart for this branch.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {finding ? (
              <>
                <p><span className="font-medium">Condition:</span> {finding.condition ?? "—"}</p>
                <p><span className="font-medium">Restoration:</span> {finding.restoration_type ?? "—"}</p>
                <p><span className="font-medium">Surgery:</span> {finding.surgery_type ?? "—"}</p>
                <p><span className="font-medium">Surfaces:</span> {finding.surfaces?.join(", ") || "—"}</p>
                <p><span className="font-medium">Notes:</span> {finding.notes ?? "—"}</p>
              </>
            ) : (
              <p className="text-neutral-500">No active finding recorded for this tooth.</p>
            )}
            <Button asChild className="mt-4">
              <Link href={`/patients/${patientId}/chart`}>Edit in Chart</Link>
            </Button>
          </CardContent>
        </Card>
      </PatientPageShell>
    </PermissionGate>
  )
}
