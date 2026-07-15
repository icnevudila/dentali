"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Save, AlertTriangle, History, ScanLine } from "lucide-react"
import { PatientPageShell } from "@/components/patients/PatientPageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useRouteParams } from "@/hooks/use-route-params"
import { useAuth } from "@/hooks/use-auth"
import { useBranch } from "@/hooks/use-branch"
import { fetchOrganization } from "@/lib/auth/auth-service"
import {
  fetchMedicalHistoryVersions,
  getLatestMedicalHistory,
  getMedicalRiskFlags,
  saveMedicalHistory,
  type MedicalHistoryRecord,
  type MedicalRiskAssessment,
} from "@/lib/patients/medical-history-service"
import {
  logMedicalHistoryOcrImport,
  type MedicalHistoryOcrDraft,
} from "@/lib/patients/medical-history-ocr-service"
import { MedicalHistoryVersionDrawer } from "@/components/patients/MedicalHistoryVersionDrawer"
import { MedicalHistoryOcrImportDialog } from "@/components/patients/MedicalHistoryOcrImportDialog"
import { getPatient } from "@/lib/patients/patient-service"

export default function MedicalHistoryPage() {
  const { id: patientId } = useRouteParams<{ id: string }>()
  const { user } = useAuth()
  const { activeBranch } = useBranch()
  const router = useRouter()
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [patientName, setPatientName] = React.useState("")
  const [allergies, setAllergies] = React.useState("")
  const [medications, setMedications] = React.useState("")
  const [conditions, setConditions] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [version, setVersion] = React.useState(0)
  const [versions, setVersions] = React.useState<MedicalHistoryRecord[]>([])
  const [historyOpen, setHistoryOpen] = React.useState(false)
  const [ocrOpen, setOcrOpen] = React.useState(false)
  const [organizationId, setOrganizationId] = React.useState<string | null>(null)
  const [pendingOcrImport, setPendingOcrImport] = React.useState<MedicalHistoryOcrDraft | null>(null)
  const [riskFlags, setRiskFlags] = React.useState<MedicalRiskAssessment | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    Promise.all([
      getPatient(patientId),
      getLatestMedicalHistory(patientId),
      fetchMedicalHistoryVersions(patientId),
      getMedicalRiskFlags(patientId),
      fetchOrganization(),
    ]).then(([patientResult, historyResult, versionsResult, riskResult, org]) => {
        if (patientResult.data) {
          setPatientName(`${patientResult.data.first_name} ${patientResult.data.last_name}`)
        }
        if (historyResult.data) {
          setAllergies(historyResult.data.allergies.join(", "))
          setMedications(historyResult.data.medications.join(", "))
          setConditions(historyResult.data.conditions.join(", "))
          setNotes(historyResult.data.notes ?? "")
          setVersion(historyResult.data.version)
        }
        setVersions(versionsResult.data)
        setRiskFlags(riskResult.data)
        setOrganizationId(org?.id ?? null)
        setLoading(false)
      }
    )
  }, [patientId])

  const parseList = (s: string) =>
    s.split(",").map((x) => x.trim()).filter(Boolean)

  const handleApplyOcrDraft = (draft: MedicalHistoryOcrDraft) => {
    setAllergies(draft.allergies.join(", "))
    setMedications(draft.medications.join(", "))
    setConditions(draft.conditions.join(", "))
    setNotes(draft.notes ?? "")
    setPendingOcrImport(draft)
    setError(null)
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    setError(null)
    const org = await fetchOrganization()
    if (!org) {
      setError("Organization not found")
      setSaving(false)
      return
    }

    const allergyList = parseList(allergies)
    const medicationList = parseList(medications)
    const conditionList = parseList(conditions)

    const { data: saved, error: saveError } = await saveMedicalHistory({
      patientId,
      organizationId: org.id,
      userId: user.id,
      branchId: activeBranch?.id,
      allergies: allergyList,
      medications: medicationList,
      conditions: conditionList,
      notes,
    })

    if (saveError) {
      setSaving(false)
      setError(saveError)
      return
    }

    if (saved && pendingOcrImport && activeBranch?.id) {
      await logMedicalHistoryOcrImport({
        organizationId: org.id,
        branchId: activeBranch.id,
        patientId,
        version: saved.version,
        storagePath: pendingOcrImport.source_storage_path,
        overallConfidence: pendingOcrImport.confidence.overall,
        fieldCounts: {
          allergies: allergyList.length,
          medications: medicationList.length,
          conditions: conditionList.length,
        },
      })
      setPendingOcrImport(null)
    }

    setSaving(false)
    if (saved) setVersion(saved.version)
    const [{ data: refreshed }, { data: risk }] = await Promise.all([
      fetchMedicalHistoryVersions(patientId),
      getMedicalRiskFlags(patientId),
    ])
    setVersions(refreshed)
    setRiskFlags(risk)
    router.push(`/patients/${patientId}`)
  }

  if (loading) {
    return <PageLoadingSkeleton variant="form" className="max-w-3xl" />
  }

  return (
    <PermissionGate permission={PERMISSIONS.MEDICAL_HISTORY_WRITE}>
      <PatientPageShell
        patientId={patientId}
        section="Medical history"
        title="Medical history"
        description={
          <>
            {patientName}
            {version > 0 ? ` · Version ${version}` : null}
          </>
        }
        maxWidth="max-w-3xl"
        className="pb-10"
        panel={false}
        error={error}
        actions={
          <div className="flex flex-wrap gap-2">
            {organizationId && activeBranch?.id ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setOcrOpen(true)}
              >
                <ScanLine className="h-4 w-4" />
                Import from paper
              </Button>
            ) : null}
            {versions.length > 0 ? (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setHistoryOpen(true)}>
                <History className="h-4 w-4" />
                History ({versions.length})
              </Button>
            ) : null}
          </div>
        }
      >
        <MedicalHistoryVersionDrawer
          versions={versions}
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
        />

        {organizationId && activeBranch?.id ? (
          <MedicalHistoryOcrImportDialog
            open={ocrOpen}
            onClose={() => setOcrOpen(false)}
            organizationId={organizationId}
            branchId={activeBranch.id}
            patientId={patientId}
            onApplyDraft={handleApplyOcrDraft}
          />
        ) : null}

        <ContentPanel className="space-y-6">

        {pendingOcrImport ? (
          <p className="rounded-lg border border-primary-100 bg-primary-50/50 px-3 py-2 text-sm text-primary-900">
            Paper import applied to the editor. Review the fields, then save a new version.
          </p>
        ) : null}

        {riskFlags && riskFlags.flags.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-amber-900">Clinical risk flags</CardTitle>
              <CardDescription>Auto-calculated from the latest saved history.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {riskFlags.flags.map((flag) => (
                <Badge
                  key={flag.code}
                  variant={flag.severity === "high" ? "danger" : "warning"}
                >
                  {flag.label}
                </Badge>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Allergies & Conditions
            </CardTitle>
            <CardDescription className="text-pretty">
              Separate items with commas. Saving creates a new version — it never overwrites the old one.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Allergies</label>
              <Input value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="Penicillin, Latex" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Medications</label>
              <Input value={medications} onChange={(e) => setMedications(e.target.value)} placeholder="Metformin, Lisinopril" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Chronic Conditions</label>
              <Input value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="Hypertension, Diabetes" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional clinical notes" />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save New Version"}
          </Button>
        </div>
        </ContentPanel>
      </PatientPageShell>
    </PermissionGate>
  )
}
