"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { fetchOrganization } from "@/lib/auth/auth-service"
import {
  fetchPatientInsuranceProfiles,
  upsertPatientInsuranceProfile,
  type PatientInsuranceProfile,
} from "@/lib/patients/insurance-service"

const PAYER_LABELS: Record<PatientInsuranceProfile["payer_type"], string> = {
  none: "Self-pay",
  hmo: "HMO",
  philhealth: "PhilHealth",
  private: "Private insurance",
}

interface PatientInsurancePanelProps {
  patientId: string
}

export function PatientInsurancePanel({ patientId }: PatientInsurancePanelProps) {
  const [profiles, setProfiles] = React.useState<PatientInsuranceProfile[]>([])
  const [loading, setLoading] = React.useState(true)
  const [editing, setEditing] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [payerType, setPayerType] = React.useState<PatientInsuranceProfile["payer_type"]>("none")
  const [payerName, setPayerName] = React.useState("")
  const [memberId, setMemberId] = React.useState("")
  const [planName, setPlanName] = React.useState("")

  const load = React.useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await fetchPatientInsuranceProfiles(patientId)
    setProfiles(data)
    setError(err)
    const primary = data.find((p) => p.is_primary) ?? data[0]
    if (primary) {
      setPayerType(primary.payer_type)
      setPayerName(primary.payer_name ?? "")
      setMemberId(primary.member_id ?? "")
      setPlanName(primary.plan_name ?? "")
    }
    setLoading(false)
  }, [patientId])

  React.useEffect(() => {
    load()
  }, [load])

  const handleSave = async () => {
    const org = await fetchOrganization()
    if (!org) return
    setSaving(true)
    setError(null)
    const { error: saveError } = await upsertPatientInsuranceProfile({
      organizationId: org.id,
      patientId,
      payerType,
      payerName: payerName || undefined,
      memberId: memberId || undefined,
      planName: planName || undefined,
    })
    setSaving(false)
    if (saveError) setError(saveError)
    else {
      setEditing(false)
      await load()
    }
  }

  const primary = profiles.find((p) => p.is_primary) ?? profiles[0]

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">Insurance / Coverage</CardTitle>
          <CardDescription>HMO, PhilHealth, or private payer details.</CardDescription>
        </div>
        <PermissionGate permission={PERMISSIONS.PATIENTS_WRITE}>
          <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>
            {editing ? "Cancel" : "Edit"}
          </Button>
        </PermissionGate>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
        )}
        {loading ? (
          <PageLoadingSkeleton variant="compact" className="h-16 rounded-md" />
        ) : editing ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium">Payer type</label>
              <select
                value={payerType}
                onChange={(e) => setPayerType(e.target.value as PatientInsuranceProfile["payer_type"])}
                className="h-10 w-full rounded-md border border-neutral-300 px-3 text-sm"
              >
                {(Object.keys(PAYER_LABELS) as PatientInsuranceProfile["payer_type"][]).map((key) => (
                  <option key={key} value={key}>
                    {PAYER_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
            {payerType !== "none" && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Payer name</label>
                  <Input value={payerName} onChange={(e) => setPayerName(e.target.value)} placeholder="Maxicare, Intellicare…" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Member ID</label>
                  <Input value={memberId} onChange={(e) => setMemberId(e.target.value)} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium">Plan name</label>
                  <Input value={planName} onChange={(e) => setPlanName(e.target.value)} />
                </div>
              </>
            )}
            <div className="sm:col-span-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save coverage"}
              </Button>
            </div>
          </div>
        ) : primary && primary.payer_type !== "none" ? (
          <div className="space-y-2 text-sm">
            <Badge variant="info">{PAYER_LABELS[primary.payer_type]}</Badge>
            {primary.payer_name && <p><span className="text-neutral-500">Payer:</span> {primary.payer_name}</p>}
            {primary.member_id && <p><span className="text-neutral-500">Member ID:</span> {primary.member_id}</p>}
            {primary.plan_name && <p><span className="text-neutral-500">Plan:</span> {primary.plan_name}</p>}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Self-pay — no insurance on file.</p>
        )}
      </CardContent>
    </Card>
  )
}
