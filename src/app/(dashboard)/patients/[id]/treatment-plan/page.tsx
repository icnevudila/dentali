"use client"

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, CheckCircle, Sparkles } from "lucide-react"
import { PatientPageShell } from "@/components/patients/PatientPageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useRouteParams } from "@/hooks/use-route-params"
import { useSearchParams } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { useBranch } from "@/hooks/use-branch"
import { fetchOrganization } from "@/lib/auth/auth-service"
import { getPatient } from "@/lib/patients/patient-service"
import { getMedicalRiskFlags } from "@/lib/patients/medical-history-service"
import { fetchProcedures } from "@/lib/billing/procedure-service"
import { AlertCircle } from "lucide-react"
import {
  createTreatmentPlan,
  getTreatmentPlan,
  addPlanItem,
  approveTreatmentPlan,
  bulkAddChartFindingsToPlan,
} from "@/lib/clinical/treatment-plan-service"
import { createInvoiceFromPlan } from "@/lib/billing/invoice-service"
import { logAuditEvent } from "@/lib/audit/audit-service"
import { fetchProcedureStockWarnings } from "@/lib/inventory/inventory-service"
import { ProcedureStockWarningBanner } from "@/components/inventory/ProcedureStockWarningBanner"
import { ChartFindingSuggestionsCard } from "@/components/clinical/ChartFindingSuggestionsCard"

function TreatmentPlanContent() {
  const { id: patientId } = useRouteParams<{ id: string }>()
  const searchParams = useSearchParams()
  const planId = searchParams.get("plan")
  const router = useRouter()
  const { user } = useAuth()
  const { activeBranch } = useBranch()

  const [patientName, setPatientName] = React.useState("")
  const [planTitle, setPlanTitle] = React.useState("")
  const [activePlanId, setActivePlanId] = React.useState(planId ?? "")
  const [planStatus, setPlanStatus] = React.useState("proposed")
  const [total, setTotal] = React.useState(0)
  const [items, setItems] = React.useState<Awaited<ReturnType<typeof getTreatmentPlan>>["items"]>([])
  const [procedures, setProcedures] = React.useState<Awaited<ReturnType<typeof fetchProcedures>>["data"]>([])
  const [selectedProc, setSelectedProc] = React.useState("")
  const [toothNumber, setToothNumber] = React.useState("")
  const [loading, setLoading] = React.useState(!!planId)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [autoInvoiceId, setAutoInvoiceId] = React.useState<string | null>(null)
  const [stockWarnings, setStockWarnings] = React.useState<
    { name: string; quantity_on_hand: number; min_stock_level: number }[]
  >([])
  const [riskFlags, setRiskFlags] = React.useState<string[]>([])

  const loadPlan = React.useCallback(async (id: string) => {
    const result = await getTreatmentPlan(id)
    if (result.plan) {
      setPlanTitle(result.plan.title)
      setPlanStatus(result.plan.status)
      setTotal(Number(result.plan.total_estimated))
      setItems(result.items)
    }
    setLoading(false)
  }, [])

  React.useEffect(() => {
    getPatient(patientId).then(({ data }) => {
      if (data) setPatientName(`${data.first_name} ${data.last_name}`)
    })
    getMedicalRiskFlags(patientId).then(({ data }) => {
      if (data) setRiskFlags(data.flags.map((flag) => flag.label))
    })
    fetchProcedures(activeBranch?.id).then(({ data }) => setProcedures(data))
    if (planId) loadPlan(planId)
    else setLoading(false)
  }, [patientId, planId, loadPlan, activeBranch?.id])

  React.useEffect(() => {
    if (!activeBranch?.id || !selectedProc) {
      setStockWarnings([])
      return
    }
    fetchProcedureStockWarnings(activeBranch.id, selectedProc).then(({ data }) => {
      setStockWarnings(data)
    })
  }, [activeBranch?.id, selectedProc])

  const handleCreatePlan = async () => {
    if (!user || !activeBranch || !planTitle.trim()) return
    setSaving(true)
    const org = await fetchOrganization()
    if (!org) { setError("Org not found"); setSaving(false); return }

    const { data, error: err } = await createTreatmentPlan({
      organizationId: org.id,
      branchId: activeBranch.id,
      patientId,
      title: planTitle.trim(),
      userId: user.id,
    })
    setSaving(false)
    if (err || !data) { setError(err ?? "Failed"); return }
    setActivePlanId(data.id)
    router.replace(`/patients/${patientId}/treatment-plan?plan=${data.id}`)
  }

  const handleAddItem = async () => {
    if (!activePlanId || !selectedProc) return
    const proc = procedures.find((p) => p.id === selectedProc)
    if (!proc) return
    setSaving(true)
    const { error: err } = await addPlanItem({
      planId: activePlanId,
      procedureId: proc.id,
      description: proc.name,
      estimatedPrice: proc.effective_price,
      toothNumber: toothNumber || undefined,
    })
    if (err) setError(err)
    else await loadPlan(activePlanId)
    setSaving(false)
  }

  const handleBulkFromChart = async () => {
    if (!activePlanId) return
    setSaving(true)
    setError(null)
    const { data, error: err } = await bulkAddChartFindingsToPlan(activePlanId)
    if (err) setError(err)
    else if (data && data.added === 0) {
      setError("No chart findings matched procedures for this plan.")
    }
    await loadPlan(activePlanId)
    setSaving(false)
  }

  const handleApprove = async () => {
    if (!activePlanId) return
    setSaving(true)
    setError(null)
    const { data, error: err } = await approveTreatmentPlan(activePlanId)
    if (err) setError(err)
    else if (data) {
      setPlanStatus(data.status)
      setTotal(data.total_estimated)
      setAutoInvoiceId(data.invoice_id)
    }
    await loadPlan(activePlanId)
    setSaving(false)
  }

  const handleConvertInvoice = async () => {
    if (!user || !activeBranch || !activePlanId) return
    setSaving(true)
    const org = await fetchOrganization()
    if (!org) { setSaving(false); return }

    const { data, error: err } = await createInvoiceFromPlan({
      organizationId: org.id,
      branchId: activeBranch.id,
      patientId,
      treatmentPlanId: activePlanId,
      totalAmount: total,
      userId: user.id,
    })
    if (!err && data) {
      await logAuditEvent({
        organizationId: org.id,
        branchId: activeBranch.id,
        action: "patient.update",
        entityType: "invoice",
        entityId: data.id,
        metadata: { from_plan: activePlanId },
      })
      router.push("/billing")
    } else setError(err ?? "Failed")
    setSaving(false)
  }

  if (loading) {
    return <PageLoadingSkeleton variant="detail" className="max-w-4xl px-4 py-8" />
  }

  const metricItems = activePlanId
    ? [
        { label: "Status", value: planStatus, hint: patientName },
        { label: "Items", value: String(items.length), hint: "Procedures on plan" },
        { label: "Estimated total", value: `₱${total.toLocaleString()}`, hint: "Before invoice" },
      ]
    : undefined

  return (
    <PermissionGate permission={PERMISSIONS.DENTAL_CHART_WRITE}>
      <PatientPageShell
        patientId={patientId}
        section="Treatment plan"
        title="Treatment plan"
        description={patientName || "Proposed procedures and estimates"}
        maxWidth="max-w-4xl"
        className="pb-10"
        error={error}
        metrics={metricItems}
      >
        {!activePlanId ? (
          <Card>
            <CardHeader>
              <CardTitle>New Treatment Plan</CardTitle>
              <CardDescription>Create a proposed treatment plan for this patient.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input value={planTitle} onChange={(e) => setPlanTitle(e.target.value)} placeholder="e.g. Restorative Phase 1" />
              <Button onClick={handleCreatePlan} disabled={saving || !planTitle.trim()}>Create Plan</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{planTitle}</CardTitle>
                  <Badge className="mt-2">{planStatus}</Badge>
                </div>
                <p className="text-lg font-bold">₱{total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <div className="space-y-2 text-sm">
                    <p className="text-neutral-500">No procedures added yet.</p>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/patients/${patientId}/chart`}>Add findings from dental chart</Link>
                    </Button>
                  </div>
                ) : (
                  <ul className="divide-y text-sm">
                    {items.map((item) => (
                      <li key={item.id} className="py-2 flex justify-between">
                        <span>{item.description}{item.tooth_number ? ` (Tooth ${item.tooth_number})` : ""}</span>
                        <span className="font-medium">₱{Number(item.estimated_price).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {planStatus !== "approved" ? (
              <>
                {riskFlags.length > 0 && (
                  <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 mb-4 animate-fade-rise flex gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-red-900">DİKKAT: Klinik Güvenlik Riski</h4>
                      <p className="mt-1 text-sm text-red-800">
                        Hastanın tıbbi geçmişinde kritik uyarılar bulunmaktadır: <strong>{riskFlags.join(", ")}</strong>. Cerrahi işlem planlamadan önce lütfen tıbbi geçmişini detaylı inceleyiniz.
                      </p>
                    </div>
                  </div>
                )}
                <ChartFindingSuggestionsCard
                  patientId={patientId}
                  branchId={activeBranch?.id ?? null}
                  procedures={procedures}
                  planItems={items}
                  onAddAll={() => void handleBulkFromChart()}
                  saving={saving}
                  disabled={!activePlanId}
                />
              </>
            ) : null}

            <Card>
              <CardHeader><CardTitle className="text-base">Add Procedure</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <select
                    value={selectedProc}
                    onChange={(e) => setSelectedProc(e.target.value)}
                    className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
                  >
                    <option value="">Select procedure…</option>
                    {procedures.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} — ₱{p.effective_price}</option>
                    ))}
                  </select>
                  <Input placeholder="Tooth # (optional)" value={toothNumber} onChange={(e) => setToothNumber(e.target.value)} />
                  <Button onClick={handleAddItem} disabled={saving || !selectedProc} className="gap-2">
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
                <ProcedureStockWarningBanner warnings={stockWarnings} />
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-2">
              {planStatus !== "approved" ? (
                <Button variant="outline" onClick={handleBulkFromChart} disabled={saving} className="gap-2">
                  <Sparkles className="h-4 w-4" /> Add from chart findings
                </Button>
              ) : null}
              {planStatus !== "approved" && (
                <Button onClick={handleApprove} disabled={saving || items.length === 0} className="gap-2">
                  <CheckCircle className="h-4 w-4" /> Approve Plan
                </Button>
              )}
              {planStatus === "approved" && !autoInvoiceId ? (
                <Button variant="default" onClick={handleConvertInvoice} disabled={saving}>
                  Convert to Invoice
                </Button>
              ) : null}
            </div>

            {autoInvoiceId ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
                Invoice draft created automatically.{" "}
                <Link href={`/billing/${autoInvoiceId}`} className="font-medium underline">
                  Open invoice
                </Link>
                {" · "}
                <Link href="/billing/hmo?status=draft" className="font-medium underline">
                  HMO claim drafts
                </Link>
              </p>
            ) : null}
          </>
        )}
      </PatientPageShell>
    </PermissionGate>
  )
}

export default function TreatmentPlanPage() {
  return (
    <Suspense fallback={<PageLoadingSkeleton variant="detail" className="max-w-4xl px-4 py-8" />}>
      <TreatmentPlanContent />
    </Suspense>
  )
}
