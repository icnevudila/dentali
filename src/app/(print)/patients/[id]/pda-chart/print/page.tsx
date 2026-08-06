"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { useRouteParams } from "@/hooks/use-route-params"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { getPatient } from "@/lib/patients/patient-service"
import { getLatestMedicalHistory, type MedicalHistoryRecord } from "@/lib/patients/medical-history-service"
import { getPatientOdontogram } from "@/lib/odontogram/dental-chart-service"
import { fetchPatientTreatmentTimeline, type TreatmentTimelineEntry } from "@/lib/clinical/treatment-plan-service"
import type { PatientRecord } from "@/lib/patients/patient-service"
import type { ToothFinding } from "@/lib/types/dental"
import { PdaNativeChartDocument } from "@/components/pda/PdaNativeChartDocument"
import { buildPdaIntakePrefill } from "@/lib/pda/pda-intake-prefill"
import { getPatientBranchVisit } from "@/lib/patients/patient-service"
import { emptyPdaIntakeResponses, mergePdaIntakeResponses, type PdaIntakeResponses } from "@/lib/pda/pda-intake-schema"
import { fetchPatientPdaIntake } from "@/lib/pda/pda-intake-service"
import { fetchStaffProfile } from "@/lib/auth/auth-service"
import { Button } from "@/components/ui/button"

export default function PdaDentalChartPrintPage() {
  const { id: patientId } = useRouteParams<{ id: string }>()
  const searchParams = useSearchParams()
  const { activeBranch } = useBranch()
  const { t } = useLocale()
  const branchId = searchParams.get("branch") ?? activeBranch?.id ?? ""
  const [ready, setReady] = React.useState(false)
  const [missingBranch, setMissingBranch] = React.useState(false)
  const [responses, setResponses] = React.useState<PdaIntakeResponses>(emptyPdaIntakeResponses())
  const [findings, setFindings] = React.useState<ToothFinding[]>([])
  const [treatmentRows, setTreatmentRows] = React.useState<TreatmentTimelineEntry[]>([])
  const [dentistName, setDentistName] = React.useState<string | null>(null)
  const [patient, setPatient] = React.useState<PatientRecord | null>(null)
  const [medicalHistory, setMedicalHistory] = React.useState<MedicalHistoryRecord | null>(null)

  React.useEffect(() => {
    document.body.classList.add("pda-print-mode")
    return () => document.body.classList.remove("pda-print-mode")
  }, [])

  React.useEffect(() => {
    if (!patientId) return
    if (!branchId) {
      setMissingBranch(true)
      setReady(true)
      return
    }
    setMissingBranch(false)
    let cancelled = false

    async function load() {
      const [patientRes, medicalRes, chartRes, treatmentRes, staff, recordRes, branchVisitRes] =
        await Promise.all([
          getPatient(patientId),
          getLatestMedicalHistory(patientId),
          getPatientOdontogram(patientId, branchId),
          fetchPatientTreatmentTimeline(patientId, branchId),
          fetchStaffProfile(),
          fetchPatientPdaIntake(patientId, branchId),
          getPatientBranchVisit(patientId, branchId),
        ])
      if (cancelled) return

      const prefill = buildPdaIntakePrefill({
        patient: patientRes.data,
        medicalHistory: medicalRes.data,
        lastClinicVisit: branchVisitRes.lastVisitAt,
      })
      const saved = recordRes.data?.responses ?? emptyPdaIntakeResponses()
      setPatient(patientRes.data)
      setMedicalHistory(medicalRes.data)
      setResponses(mergePdaIntakeResponses(saved, prefill))
      setFindings(chartRes.data?.findings ?? [])
      setTreatmentRows(treatmentRes.data ?? [])
      setDentistName(staff?.full_name ?? null)
      setReady(true)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [patientId, branchId])

  React.useEffect(() => {
    if (!ready || missingBranch || !patient) return
    const timer = window.setTimeout(() => window.print(), 600)
    return () => window.clearTimeout(timer)
  }, [ready, missingBranch, patient])

  if (!ready) {
    return (
      <div className="pda-print-route flex min-h-screen flex-col">
        <header className="pda-print-toolbar no-print">
          <span className="pda-print-toolbar-title">
            {t("print.pdaPreviewTitle", "PDA dental chart — print preview")}
          </span>
        </header>
        <div className="flex flex-1 items-center justify-center text-sm text-neutral-600">
          {t("print.loadingPda", "Preparing PDA form…")}
        </div>
      </div>
    )
  }

  if (missingBranch) {
    return (
      <div className="pda-print-route flex min-h-screen flex-col">
        <header className="pda-print-toolbar no-print">
          <span className="pda-print-toolbar-title">
            {t("print.pdaPreviewTitle", "PDA dental chart — print preview")}
          </span>
          <div className="pda-print-toolbar-actions">
            <Button size="sm" variant="outline" onClick={() => window.close()}>
              {t("print.printClose", "Close")}
            </Button>
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm font-semibold text-rose-600">
          {t("print.emptyPdaBranch", "Select a clinic branch before printing the PDA chart.")}
        </div>
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="pda-print-route flex min-h-screen flex-col">
        <header className="pda-print-toolbar no-print">
          <span className="pda-print-toolbar-title">
            {t("print.pdaPreviewTitle", "PDA dental chart — print preview")}
          </span>
          <div className="pda-print-toolbar-actions">
            <Button size="sm" variant="outline" onClick={() => window.close()}>
              {t("print.printClose", "Close")}
            </Button>
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm font-semibold text-rose-600">
          {t("print.emptyPda", "Patient record is not available for PDA chart print.")}
        </div>
      </div>
    )
  }

  return (
    <div className="pda-print-route">
      <header className="pda-print-toolbar no-print">
        <span className="pda-print-toolbar-title">
          {t("print.pdaPreviewTitle", "PDA dental chart — print preview")}
        </span>
        <div className="pda-print-toolbar-actions">
          <Button size="sm" onClick={() => window.print()}>
            {t("common.printPdf", "Print / PDF")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.close()}>
            {t("print.printClose", "Close")}
          </Button>
        </div>
      </header>
      <PdaNativeChartDocument
        patient={patient}
        medicalHistory={medicalHistory}
        responses={responses}
        findings={findings}
        treatmentRows={treatmentRows}
        dentistName={dentistName}
      />
    </div>
  )
}
