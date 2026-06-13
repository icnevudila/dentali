"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Save, AlertTriangle, History } from "lucide-react"
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
import { MedicalHistoryVersionDrawer } from "@/components/patients/MedicalHistoryVersionDrawer"
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
  const [riskFlags, setRiskFlags] = React.useState<MedicalRiskAssessment | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    Promise.all([
      getPatient(patientId),
      getLatestMedicalHistory(patientId),
      fetchMedicalHistoryVersions(patientId),
      getMedicalRiskFlags(patientId),
    ]).then(([patientResult, historyResult, versionsResult, riskResult]) => {
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
        setLoading(false)
      }
    )
  }, [patientId])

  const parseList = (s: string) =>
    s.split(",").map((x) => x.trim()).filter(Boolean)

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

    const { data: saved, error: saveError } = await saveMedicalHistory({
      patientId,
      organizationId: org.id,
      userId: user.id,
      branchId: activeBranch?.id,
      allergies: parseList(allergies),
      medications: parseList(medications),
      conditions: parseList(conditions),
      notes,
    })

    setSaving(false)
    if (saveError) setError(saveError)
    else {
      if (saved) setVersion(saved.version)
      const [{ data: refreshed }, { data: risk }] = await Promise.all([
        fetchMedicalHistoryVersions(patientId),
        getMedicalRiskFlags(patientId),
      ])
      setVersions(refreshed)
      setRiskFlags(risk)
      router.push(`/patients/${patientId}`)
    }
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
          versions.length > 0 ? (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setHistoryOpen(true)}>
              <History className="h-4 w-4" />
              History ({versions.length})
            </Button>
          ) : null
        }
      >
        <MedicalHistoryVersionDrawer
          versions={versions}
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
        />

        <ContentPanel className="space-y-6">

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
            <CardDescription>Comma-separated values. Saving creates a new version.</CardDescription>
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
