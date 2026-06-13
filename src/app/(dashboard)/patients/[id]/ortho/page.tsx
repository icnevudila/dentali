"use client"

import * as React from "react"
import Link from "next/link"
import { Plus, Lock } from "lucide-react"
import { PatientPageShell } from "@/components/patients/PatientPageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useRouteParams } from "@/hooks/use-route-params"
import { useAuth } from "@/hooks/use-auth"
import { useBranch } from "@/hooks/use-branch"
import { usePermission } from "@/hooks/use-permission"
import { fetchOrganization } from "@/lib/auth/auth-service"
import { getPatient } from "@/lib/patients/patient-service"
import {
  closeOrthoCase,
  createOrthoCase,
  fetchOrthoAdjustments,
  fetchOrthoBalance,
  fetchOrthoCase,
  logOrthoAdjustment,
  type OrthoAdjustment,
  type OrthoBalance,
  type OrthoCase,
} from "@/lib/clinical/ortho-service"
import { OrthoCaseTimelinePanel } from "@/components/clinical/OrthoCaseTimelinePanel"

export default function OrthoRecordPage() {
  const { id: patientId } = useRouteParams<{ id: string }>()
  const { user } = useAuth()
  const { activeBranch } = useBranch()
  const { hasPermission } = usePermission()
  const canWrite = hasPermission(PERMISSIONS.DENTAL_CHART_WRITE)

  const [patientName, setPatientName] = React.useState("")
  const [orthoCase, setOrthoCase] = React.useState<OrthoCase | null>(null)
  const [adjustments, setAdjustments] = React.useState<OrthoAdjustment[]>([])
  const [balance, setBalance] = React.useState<OrthoBalance | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [showNewCase, setShowNewCase] = React.useState(false)
  const [showAddRow, setShowAddRow] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  const [applianceType, setApplianceType] = React.useState("Metal braces")
  const [startDate, setStartDate] = React.useState("")
  const [contractAmount, setContractAmount] = React.useState("")
  const [caseNotes, setCaseNotes] = React.useState("")

  const [adjDate, setAdjDate] = React.useState("")
  const [procedure, setProcedure] = React.useState("")
  const [nextProcedure, setNextProcedure] = React.useState("")
  const [nextVisitDate, setNextVisitDate] = React.useState("")
  const [paymentAmount, setPaymentAmount] = React.useState("")
  const [adjNotes, setAdjNotes] = React.useState("")

  const load = React.useCallback(async () => {
    if (!activeBranch || !patientId) return
    setLoading(true)
    const { data: c, error: caseErr } = await fetchOrthoCase(patientId, activeBranch.id)
    setOrthoCase(c)
    setError(caseErr)

    if (c) {
      const [adjRes, balRes] = await Promise.all([
        fetchOrthoAdjustments(c.id),
        fetchOrthoBalance(c.id),
      ])
      setAdjustments(adjRes.data)
      setBalance(balRes.data)
      if (adjRes.error) setError(adjRes.error)
    } else {
      setAdjustments([])
      setBalance(null)
    }
    setLoading(false)
  }, [activeBranch, patientId])

  React.useEffect(() => {
    getPatient(patientId).then(({ data }) => {
      if (data) setPatientName(`${data.first_name} ${data.last_name}`)
    })
    load()
  }, [patientId, load])

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !activeBranch) return
    setSaving(true)
    const org = await fetchOrganization()
    if (!org) {
      setError("Organization not found")
      setSaving(false)
      return
    }
    const { error: err } = await createOrthoCase({
      organizationId: org.id,
      branchId: activeBranch.id,
      patientId,
      applianceType,
      startDate,
      contractAmount: parseFloat(contractAmount) || 0,
      notes: caseNotes || undefined,
      userId: user.id,
    })
    setSaving(false)
    if (err) setError(err)
    else {
      setShowNewCase(false)
      load()
    }
  }

  const handleLogAdjustment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orthoCase || !procedure.trim()) return
    setSaving(true)
    const { error: err } = await logOrthoAdjustment({
      caseId: orthoCase.id,
      adjustmentDate: adjDate || new Date().toISOString().slice(0, 10),
      procedure: procedure.trim(),
      nextProcedure: nextProcedure || undefined,
      nextVisitDate: nextVisitDate || undefined,
      paymentAmount: parseFloat(paymentAmount) || 0,
      notes: adjNotes || undefined,
    })
    setSaving(false)
    if (err) setError(err)
    else {
      setShowAddRow(false)
      setProcedure("")
      setNextProcedure("")
      setNextVisitDate("")
      setPaymentAmount("")
      setAdjNotes("")
      load()
    }
  }

  const handleCloseCase = async () => {
    if (!orthoCase || !confirm("Close this orthodontic case?")) return
    setSaving(true)
    const { error: err } = await closeOrthoCase(orthoCase.id)
    setSaving(false)
    if (err) setError(err)
    else load()
  }

  const orthoMetrics = orthoCase
    ? [
        {
          label: "Contract",
          value: `₱${(orthoCase.contract_amount ?? 0).toLocaleString()}`,
          hint: orthoCase.appliance_type ?? "Appliance",
        },
        {
          label: "Balance",
          value: balance ? `₱${balance.balance.toLocaleString()}` : "—",
          hint: balance ? `₱${balance.total_paid.toLocaleString()} paid` : "Payment ledger",
          variant: balance && balance.balance > 0 ? ("warning" as const) : ("success" as const),
        },
        {
          label: "Adjustments",
          value: String(adjustments.length),
          hint: orthoCase.status,
        },
      ]
    : undefined

  return (
    <PermissionGate permission={PERMISSIONS.DENTAL_CHART_READ}>
      <PatientPageShell
        patientId={patientId}
        section="Orthodontics"
        title="Orthodontic record"
        description={`${patientName}${activeBranch ? ` · ${activeBranch.name}` : ""}`}
        maxWidth="max-w-5xl"
        error={error}
        onRetry={load}
        metrics={!loading ? orthoMetrics : undefined}
        panel={false}
      >
        {loading ? (
          <PageLoadingSkeleton variant="inline" />
        ) : !orthoCase ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-neutral-500 mb-4">No active orthodontic case for this branch.</p>
              {canWrite && (
                <Button onClick={() => setShowNewCase(true)} className="gap-2">
                  <Plus className="h-4 w-4" /> Start ortho case
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-4">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-neutral-500">Appliance</p>
                  <p className="font-semibold">{orthoCase.appliance_type ?? "—"}</p>
                  <Badge className="mt-1">{orthoCase.status}</Badge>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-neutral-500">Contract</p>
                  <p className="font-semibold">₱{(balance?.contract_amount ?? orthoCase.contract_amount).toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-neutral-500">Paid</p>
                  <p className="font-semibold text-emerald-700">₱{(balance?.total_paid ?? 0).toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-neutral-500">Balance</p>
                  <p className="font-semibold text-amber-700">₱{(balance?.balance ?? orthoCase.contract_amount).toLocaleString()}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Visit charts</CardTitle>
                <CardDescription>Balance trend and adjustment timeline for this case</CardDescription>
              </CardHeader>
              <CardContent>
                <OrthoCaseTimelinePanel
                  contractAmount={balance?.contract_amount ?? orthoCase.contract_amount}
                  adjustments={adjustments}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Adjustment log</CardTitle>
                  <CardDescription>Date · Procedure · Next visit · Payment · Balance</CardDescription>
                </div>
                {canWrite && orthoCase.status === "active" && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowAddRow(true)}>
                      <Plus className="h-4 w-4" /> Log visit
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-2" onClick={handleCloseCase} disabled={saving}>
                      <Lock className="h-4 w-4" /> Close case
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {adjustments.length === 0 ? (
                  <p className="text-center py-8 text-neutral-500 text-sm">No adjustments logged yet.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-neutral-500">
                        <th className="pb-2 text-left font-medium">Date</th>
                        <th className="pb-2 text-left font-medium">Procedure</th>
                        <th className="pb-2 text-left font-medium">Next procedure</th>
                        <th className="pb-2 text-left font-medium">Next date</th>
                        <th className="pb-2 text-right font-medium">Payment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {adjustments.map((a) => (
                        <tr key={a.id}>
                          <td className="py-2 whitespace-nowrap">{a.adjustment_date}</td>
                          <td className="py-2">{a.procedure}</td>
                          <td className="py-2 text-neutral-600">{a.next_procedure ?? "—"}</td>
                          <td className="py-2 text-neutral-600">{a.next_visit_date ?? "—"}</td>
                          <td className="py-2 text-right">₱{Number(a.payment_amount).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {showNewCase && (
          <Card className="border-primary-200">
            <CardHeader>
              <CardTitle className="text-base">New orthodontic case</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateCase} className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Appliance type</label>
                  <select
                    className="w-full h-9 rounded-md border border-neutral-200 px-3 text-sm"
                    value={applianceType}
                    onChange={(e) => setApplianceType(e.target.value)}
                  >
                    <option>Metal braces</option>
                    <option>Ceramic braces</option>
                    <option>Clear aligners</option>
                    <option>Retainer</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Start date</label>
                  <Input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Contract amount (₱)</label>
                  <Input type="number" min="0" step="0.01" value={contractAmount} onChange={(e) => setContractAmount(e.target.value)} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium">Notes</label>
                  <Input value={caseNotes} onChange={(e) => setCaseNotes(e.target.value)} />
                </div>
                <div className="sm:col-span-2 flex gap-2">
                  <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create case"}</Button>
                  <Button type="button" variant="outline" onClick={() => setShowNewCase(false)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {showAddRow && orthoCase && (
          <Card className="border-primary-200">
            <CardHeader>
              <CardTitle className="text-base">Log adjustment visit</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogAdjustment} className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Date</label>
                  <Input type="date" value={adjDate} onChange={(e) => setAdjDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Procedure *</label>
                  <Input required value={procedure} onChange={(e) => setProcedure(e.target.value)} placeholder="Wire change, bonding…" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Next procedure</label>
                  <Input value={nextProcedure} onChange={(e) => setNextProcedure(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Next visit date</label>
                  <Input type="date" value={nextVisitDate} onChange={(e) => setNextVisitDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Payment (₱)</label>
                  <Input type="number" min="0" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium">Notes</label>
                  <Input value={adjNotes} onChange={(e) => setAdjNotes(e.target.value)} />
                </div>
                <div className="sm:col-span-2 flex gap-2">
                  <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save entry"}</Button>
                  <Button type="button" variant="outline" onClick={() => setShowAddRow(false)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </PatientPageShell>
    </PermissionGate>
  )
}
