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
import { createClient } from "@/lib/supabase/client"
import type { ToothFinding } from "@/lib/types/dental"

interface ToothHistoryEvent {
  id: string
  title: string
  plan: string
  created_at: string
  dentist_name: string
}

export default function ToothDetailPage() {
  const { id: patientId, toothId } = useRouteParams<{ id: string; toothId: string }>()
  const { activeBranch } = useBranch()
  const [finding, setFinding] = React.useState<ToothFinding | null>(null)
  const [patientName, setPatientName] = React.useState("")
  const [history, setHistory] = React.useState<ToothHistoryEvent[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!patientId || !activeBranch) return
    
    const supabase = createClient()
    
    Promise.all([
      getPatientOdontogram(patientId, activeBranch.id),
      getPatient(patientId),
      supabase
        .from("clinical_notes")
        .select(`
          id, 
          title, 
          subjective, 
          objective, 
          assessment, 
          plan, 
          created_at, 
          profiles!created_by(full_name)
        `)
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
    ]).then(([chart, patient, notesRes]) => {
      if (chart.error) setError(chart.error)
      const match = chart.data?.findings.find((f) => f.tooth_number === toothId)
      setFinding(match ?? null)
      if (patient.data) {
        setPatientName(`${patient.data.first_name} ${patient.data.last_name}`)
      }

      // Filter clinical notes containing this tooth number in the details
      if (notesRes.data) {
        const regex = new RegExp(`\\b(tooth\\s*${toothId}|diş\\s*${toothId}|#\\s*${toothId}|\\b${toothId}\\b)`, "i")
        const matchingEvents = notesRes.data
          .filter((note) => {
            const combinedText = [
              note.title,
              note.subjective,
              note.objective,
              note.assessment,
              note.plan
            ].filter(Boolean).join(" ").toLowerCase()
            return regex.test(combinedText)
          })
          .map((note) => ({
            id: note.id,
            title: note.title,
            plan: note.plan ?? "",
            created_at: note.created_at,
            dentist_name: (note.profiles as any)?.full_name ?? "Dentist",
          }))
        setHistory(matchingEvents)
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
        backLabel="Back to dental chart"
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
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border border-neutral-200 shadow-sm">
            <CardHeader>
              <CardTitle>Clinical Finding</CardTitle>
              <CardDescription>Data from the active dental chart for this branch.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {finding ? (
                <>
                  <p><span className="font-medium text-neutral-600">Condition:</span> {finding.condition ?? "—"}</p>
                  <p><span className="font-medium text-neutral-600">Restoration:</span> {finding.restoration_type ?? "—"}</p>
                  <p><span className="font-medium text-neutral-600">Surgery:</span> {finding.surgery_type ?? "—"}</p>
                  <p><span className="font-medium text-neutral-600">Surfaces:</span> {finding.surfaces?.join(", ") || "—"}</p>
                  <p><span className="font-medium text-neutral-600">Notes:</span> {finding.notes ?? "—"}</p>
                </>
              ) : (
                <p className="text-neutral-500">No active finding recorded for this tooth.</p>
              )}
              <div className="pt-2">
                <Button asChild>
                  <Link href={`/patients/${patientId}/chart`}>Edit in Chart</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-neutral-200 shadow-sm">
            <CardHeader>
              <CardTitle>Tooth History &amp; Treatments</CardTitle>
              <CardDescription>Previous treatments and clinical SOAP notes referencing this tooth.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
              {history.length > 0 ? (
                <div className="relative border-l border-neutral-200 pl-4 space-y-4">
                  {history.map((event) => (
                    <div key={event.id} className="relative">
                      {/* Timeline dot */}
                      <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-primary-500 border border-white" />
                      
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-neutral-900 text-sm">{event.title}</span>
                          <span className="text-[10px] text-neutral-400 font-medium">
                            {new Date(event.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-500">By {event.dentist_name}</p>
                        {event.plan && (
                          <p className="text-xs text-neutral-700 bg-neutral-50 p-2 rounded border border-neutral-100 whitespace-pre-wrap mt-1">
                            {event.plan}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-neutral-500 text-center py-8">
                  No historical procedures or SOAP notes found for Tooth {toothId}.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </PatientPageShell>
    </PermissionGate>
  )
}
