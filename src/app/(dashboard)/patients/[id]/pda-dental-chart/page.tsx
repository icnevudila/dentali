"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, ExternalLink, Printer } from "lucide-react"
import { useRouteParams } from "@/hooks/use-route-params"
import { useBranch } from "@/hooks/use-branch"
import { getPatient, type PatientRecord } from "@/lib/patients/patient-service"
import { fetchStaffProfile } from "@/lib/auth/auth-service"
import { getLatestMedicalHistory, type MedicalHistoryRecord } from "@/lib/patients/medical-history-service"
import { getPatientOdontogram } from "@/lib/odontogram/dental-chart-service"
import { fetchPatientTreatmentTimeline, type TreatmentTimelineEntry } from "@/lib/clinical/treatment-plan-service"
import type { ToothFinding } from "@/lib/types/dental"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { Button } from "@/components/ui/button"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { PdaDentalChartDocument } from "@/components/odontogram/PdaDentalChartDocument"
import { printElementById } from "@/lib/utils/print"
import { NAV_BACK_TRANSITION } from "@/lib/navigation/view-transition"

const ORIGINAL_PDA_PDF = "/forms/pda-dental-chart/PDA-Dental-Chart.pdf"

export default function PdaDentalChartPage() {
  const { id: patientId } = useRouteParams<{ id: string }>()
  const { activeBranch } = useBranch()
  const [patient, setPatient] = React.useState<PatientRecord | null>(null)
  const [medicalHistory, setMedicalHistory] = React.useState<MedicalHistoryRecord | null>(null)
  const [findings, setFindings] = React.useState<ToothFinding[]>([])
  const [treatmentRows, setTreatmentRows] = React.useState<TreatmentTimelineEntry[]>([])
  const [dentistName, setDentistName] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!patientId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      const [patientRes, staff, medicalRes, chartRes, treatmentRes] = await Promise.all([
        getPatient(patientId),
        fetchStaffProfile(),
        getLatestMedicalHistory(patientId),
        getPatientOdontogram(patientId, activeBranch?.id ?? null),
        fetchPatientTreatmentTimeline(patientId, activeBranch?.id ?? null),
      ])
      if (cancelled) return
      if (!patientRes.data) {
        setError(patientRes.error ?? "Patient not found")
        setLoading(false)
        return
      }
      setPatient(patientRes.data)
      setMedicalHistory(medicalRes.data ?? null)
      setFindings(chartRes.data?.findings ?? [])
      setTreatmentRows(treatmentRes.data ?? [])
      setDentistName(staff?.full_name ?? null)
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [patientId, activeBranch?.id])

  if (loading) return <PageLoadingSkeleton variant="detail" className="max-w-5xl px-4 py-8" />

  if (error) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error}</div>
      </div>
    )
  }

  return (
    <PermissionGate permission={PERMISSIONS.DENTAL_CHART_READ}>
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 print:hidden">
        <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Button variant="ghost" size="sm" asChild className="-ml-3 text-neutral-500 hover:text-neutral-900">
              <Link href={`/patients/${patientId}/chart`} transitionTypes={NAV_BACK_TRANSITION}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to dental chart
              </Link>
            </Button>
            <h1 className="mt-2 text-xl font-bold text-neutral-950">PDA Dental Chart</h1>
            <p className="text-sm text-neutral-500">
              Official PDA template with patient, medical history, chart findings, and treatment rows overlaid.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                printElementById("pda-dental-chart-print", {
                  title: `PDA Dental Chart - ${patient?.last_name ?? "Patient"}`,
                  extraCss: "@page { size: letter; margin: 0; } body { padding: 0 !important; }",
                })
              }
            >
              <Printer className="mr-2 h-4 w-4" />
              Print / Save PDF
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={ORIGINAL_PDA_PDF} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Original blank PDF
              </a>
            </Button>
          </div>
        </div>
      </div>

      <PdaDentalChartDocument
        patient={patient}
        medicalHistory={medicalHistory}
        findings={findings}
        treatmentRows={treatmentRows}
        dentistName={dentistName}
      />
    </PermissionGate>
  )
}
