"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, Link2, Printer, Save } from "lucide-react"
import { useRouteParams } from "@/hooks/use-route-params"
import { useBranch } from "@/hooks/use-branch"
import { getPatient } from "@/lib/patients/patient-service"
import { getLatestMedicalHistory } from "@/lib/patients/medical-history-service"
import { getPatientOdontogram } from "@/lib/odontogram/dental-chart-service"
import { fetchPatientTreatmentTimeline, type TreatmentTimelineEntry } from "@/lib/clinical/treatment-plan-service"
import type { ToothFinding } from "@/lib/types/dental"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { PdaIntakeForm } from "@/components/pda/PdaIntakeForm"
import { PdaDentalChartDocument } from "@/components/odontogram/PdaDentalChartDocument"
import { printElementById } from "@/lib/utils/print"
import { NAV_BACK_TRANSITION } from "@/lib/navigation/view-transition"
import { buildPdaIntakePrefill } from "@/lib/pda/pda-intake-prefill"
import {
  emptyPdaIntakeResponses,
  mergePdaIntakeResponses,
  type PdaIntakeResponses,
  type PdaIntakeStatus,
} from "@/lib/pda/pda-intake-schema"
import {
  createPdaIntakeSigningToken,
  fetchPatientPdaIntake,
  upsertPatientPdaIntake,
} from "@/lib/pda/pda-intake-service"
import { fetchStaffProfile } from "@/lib/auth/auth-service"
import { notify } from "@/lib/ui/notify"

function collectPrefillKeys(prefill: PdaIntakeResponses): Set<string> {
  const keys = new Set<string>()
  const walk = (obj: Record<string, unknown>, prefix: string) => {
    for (const [k, v] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${k}` : k
      if (typeof v === "string" && v.trim()) keys.add(path)
      else if (v && typeof v === "object" && !Array.isArray(v)) walk(v as Record<string, unknown>, path)
    }
  }
  walk(prefill as unknown as Record<string, unknown>, "")
  return keys
}

const STATUS_LABELS: Record<PdaIntakeStatus, string> = {
  draft: "Draft",
  patient_pending: "Awaiting patient",
  completed: "Completed",
}

export default function PdaDentalChartPage() {
  const { id: patientId } = useRouteParams<{ id: string }>()
  const { activeBranch } = useBranch()
  const [responses, setResponses] = React.useState<PdaIntakeResponses>(emptyPdaIntakeResponses())
  const [recordId, setRecordId] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState<PdaIntakeStatus>("draft")
  const [findings, setFindings] = React.useState<ToothFinding[]>([])
  const [treatmentRows, setTreatmentRows] = React.useState<TreatmentTimelineEntry[]>([])
  const [dentistName, setDentistName] = React.useState<string | null>(null)
  const [prefillKeys, setPrefillKeys] = React.useState<Set<string>>(new Set())
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [showPrint, setShowPrint] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [dirty, setDirty] = React.useState(false)

  React.useEffect(() => {
    if (!patientId || !activeBranch?.id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      const [patientRes, medicalRes, chartRes, treatmentRes, staff, recordRes] = await Promise.all([
        getPatient(patientId),
        getLatestMedicalHistory(patientId),
        getPatientOdontogram(patientId, activeBranch!.id),
        fetchPatientTreatmentTimeline(patientId, activeBranch!.id),
        fetchStaffProfile(),
        fetchPatientPdaIntake(patientId, activeBranch!.id),
      ])
      if (cancelled) return

      const prefill = buildPdaIntakePrefill({
        patient: patientRes.data,
        medicalHistory: medicalRes.data,
      })
      setPrefillKeys(collectPrefillKeys(prefill))

      const saved = recordRes.data?.responses ?? emptyPdaIntakeResponses()
      setResponses(mergePdaIntakeResponses(saved, prefill))
      setRecordId(recordRes.data?.id ?? null)
      setStatus(recordRes.data?.status ?? "draft")
      setFindings(chartRes.data?.findings ?? [])
      setTreatmentRows(treatmentRes.data ?? [])
      setDentistName(staff?.full_name ?? null)
      if (recordRes.error) setError(recordRes.error)
      setLoading(false)
      setDirty(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [patientId, activeBranch?.id])

  const handleChange = (next: PdaIntakeResponses) => {
    setResponses(next)
    setDirty(true)
  }

  const save = async (nextStatus: PdaIntakeStatus = "draft") => {
    if (!activeBranch?.id) return
    setSaving(true)
    setError(null)
    const { data, error: saveErr } = await upsertPatientPdaIntake({
      patientId,
      branchId: activeBranch.id,
      responses,
      status: nextStatus,
    })
    setSaving(false)
    if (saveErr) {
      setError(saveErr)
      notify.error(saveErr)
      return
    }
    if (data) {
      setRecordId(data.id)
      setStatus(data.status)
    }
    setDirty(false)
    notify.success(nextStatus === "completed" ? "PDA form completed" : "PDA form saved")
  }

  const sendPatientLink = async () => {
    if (!activeBranch?.id) return
    setSaving(true)
    const { data: saved, error: saveErr } = await upsertPatientPdaIntake({
      patientId,
      branchId: activeBranch.id,
      responses,
      status: "draft",
    })
    setSaving(false)
    if (saveErr || !saved?.id) {
      notify.error(saveErr ?? "Could not save form")
      return
    }
    setRecordId(saved.id)
    setDirty(false)
    const { token, error: linkErr } = await createPdaIntakeSigningToken({ recordId: saved.id })
    if (linkErr || !token) {
      notify.error(linkErr ?? "Could not create link")
      return
    }
    const url = `${window.location.origin}/pda/${token}`
    await navigator.clipboard.writeText(url)
    setStatus("patient_pending")
    notify.success("Patient link copied to clipboard")
  }

  const handlePrint = () => {
    setShowPrint(true)
    window.setTimeout(() => {
      printElementById("pda-intake-print", {
        title: `PDA Dental Chart`,
        extraCss: "@page { size: letter; margin: 0; } body { padding: 0 !important; }",
      })
    }, 300)
  }

  if (loading) return <PageLoadingSkeleton variant="detail" className="max-w-4xl px-4 py-8" />

  if (!activeBranch) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-sm text-neutral-600">Select a branch to open the PDA form.</div>
    )
  }

  return (
    <PermissionGate permission={PERMISSIONS.DENTAL_CHART_READ}>
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Button variant="ghost" size="sm" asChild className="-ml-3 text-neutral-500 hover:text-neutral-900">
              <Link href={`/patients/${patientId}/chart`} transitionTypes={NAV_BACK_TRANSITION}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to dental chart
              </Link>
            </Button>
            <h1 className="mt-2 text-xl font-bold text-neutral-950">PDA Dental Chart</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Digital patient record form with auto-fill from clinic data. Chart and treatment rows sync on print.
            </p>
            <Badge variant="outline" className="mt-2">
              {STATUS_LABELS[status]}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void sendPatientLink()} className="gap-2">
              <Link2 className="h-4 w-4" />
              Patient link
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              Print / PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={saving || !dirty}
              onClick={() => void save("draft")}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save draft"}
            </Button>
            <Button size="sm" disabled={saving} onClick={() => void save("completed")} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Mark complete
            </Button>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>
        ) : null}

        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
          <PdaIntakeForm
            value={responses}
            onChange={handleChange}
            prefillKeys={prefillKeys}
            findings={findings}
            treatmentRows={treatmentRows}
          />
        </div>
      </div>

      {showPrint ? (
        <div className="sr-only print:not-sr-only">
          <PdaDentalChartDocument
            patient={null}
            responses={responses}
            findings={findings}
            treatmentRows={treatmentRows}
            dentistName={dentistName}
            printRootId="pda-intake-print"
          />
        </div>
      ) : null}
    </PermissionGate>
  )
}
