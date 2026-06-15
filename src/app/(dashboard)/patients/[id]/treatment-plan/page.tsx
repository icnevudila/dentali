"use client"

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, CheckCircle, Sparkles } from "lucide-react"
import { useLocale } from "@/hooks/use-locale"
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
import { fetchProcedures, seedDefaultProcedures, createProcedure } from "@/lib/billing/procedure-service"
import { AlertCircle } from "lucide-react"
import {
  createTreatmentPlan,
  getTreatmentPlan,
  addPlanItem,
  approveTreatmentPlan,
  bulkAddChartFindingsToPlan,
  updatePlanItem,
  deletePlanItem,
} from "@/lib/clinical/treatment-plan-service"
import { createInvoiceFromPlan, getLinkedInvoiceForPlan, resyncDraftInvoiceFromPlan } from "@/lib/billing/invoice-service"
import { logAuditEvent } from "@/lib/audit/audit-service"
import { fetchProcedureStockWarnings } from "@/lib/inventory/inventory-service"
import { ProcedureStockWarningBanner } from "@/components/inventory/ProcedureStockWarningBanner"
import { ChartFindingSuggestionsCard } from "@/components/clinical/ChartFindingSuggestionsCard"
import { TreatmentPlanItemRow } from "@/components/clinical/TreatmentPlanItemRow"

const PROCEDURE_TEMPLATES = [
  { code: "EXAM", name: "Oral Examination", price: 500, category: "preventive" },
  { code: "PROPH", name: "Prophylaxis / Cleaning", price: 2500, category: "preventive" },
  { code: "FILL", name: "Composite Filling", price: 3500, category: "restorative" },
  { code: "RCT", name: "Root Canal Treatment", price: 12000, category: "restorative" },
  { code: "EXT", name: "Tooth Extraction", price: 4000, category: "surgery" },
  { code: "CRWN", name: "Jacket Crown", price: 15000, category: "restorative" },
  { code: "PFM", name: "PFM Crown", price: 1500, category: "restorative" },
  { code: "ZIRC", name: "Zirconia Crown (Single)", price: 2500, category: "restorative" },
  { code: "EMAX", name: "E-Max Veneer", price: 3500, category: "restorative" },
  { code: "NG", name: "Nightguard (Hard/Soft)", price: 1200, category: "preventive" },
  { code: "DENT", name: "Complete Denture (Upper & Lower)", price: 5000, category: "prosthodontics" },
]

function TreatmentPlanContent() {
  const { id: patientId } = useRouteParams<{ id: string }>()
  const searchParams = useSearchParams()
  const planId = searchParams.get("plan")
  const router = useRouter()
  const { user } = useAuth()
  const { activeBranch } = useBranch()
  const { t } = useLocale()

  const [patientName, setPatientName] = React.useState("")
  const [planTitle, setPlanTitle] = React.useState("")
  const [activePlanId, setActivePlanId] = React.useState(planId ?? "")
  const [planStatus, setPlanStatus] = React.useState("proposed")
  const [total, setTotal] = React.useState(0)
  const [items, setItems] = React.useState<Awaited<ReturnType<typeof getTreatmentPlan>>["items"]>([])
  const [procedures, setProcedures] = React.useState<Awaited<ReturnType<typeof fetchProcedures>>["data"]>([])
  const [selectedProc, setSelectedProc] = React.useState("")
  const [toothNumber, setToothNumber] = React.useState("")
  const [isCustom, setIsCustom] = React.useState(false)
  const [customName, setCustomName] = React.useState("")
  const [customPrice, setCustomPrice] = React.useState("")
  const [customCode, setCustomCode] = React.useState("")
  const [loading, setLoading] = React.useState(!!planId)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [autoInvoiceId, setAutoInvoiceId] = React.useState<string | null>(null)
  const [stockWarnings, setStockWarnings] = React.useState<
    { name: string; quantity_on_hand: number; min_stock_level: number }[]
  >([])
  const [riskFlags, setRiskFlags] = React.useState<string[]>([])
  const [seeding, setSeeding] = React.useState(false)

  const handleSeedDefaults = async () => {
    setSeeding(true)
    setError(null)
    try {
      const org = await fetchOrganization()
      if (org) {
        await seedDefaultProcedures(org.id)
        const { data } = await fetchProcedures(activeBranch?.id)
        setProcedures(data)
      }
    } catch (e: any) {
      setError(e.message || "Failed to load default procedures")
    } finally {
      setSeeding(false)
    }
  }

  const loadPlan = React.useCallback(async (id: string) => {
    const [result, invoiceResult] = await Promise.all([
      getTreatmentPlan(id),
      getLinkedInvoiceForPlan(id),
    ])
    if (result.plan) {
      setPlanTitle(result.plan.title)
      setPlanStatus(result.plan.status)
      setTotal(Number(result.plan.total_estimated))
      setItems(result.items)
    }
    setAutoInvoiceId(invoiceResult.data?.id ?? null)
    setLoading(false)
  }, [])

  const syncInvoiceIfNeeded = React.useCallback(async () => {
    if (!activePlanId) return
    let invoiceId = autoInvoiceId
    if (!invoiceId) {
      const { data } = await getLinkedInvoiceForPlan(activePlanId)
      if (!data || data.status !== "draft") return
      invoiceId = data.id
      setAutoInvoiceId(data.id)
    }
    const { error: syncErr } = await resyncDraftInvoiceFromPlan(invoiceId, activePlanId)
    if (syncErr) setError(syncErr)
  }, [autoInvoiceId, activePlanId])

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
    if (!activePlanId) return
    
    setSaving(true)
    setError(null)
    
    let procId: string | undefined = undefined
    let procName = ""
    let procPrice = 0
    
    if (selectedProc === "custom" || isCustom) {
      if (!customName.trim()) {
        setError("Please enter a procedure name.")
        setSaving(false)
        return
      }
      const priceVal = parseFloat(customPrice) || 0
      
      const org = await fetchOrganization()
      if (!org) {
        setError("Organization not found.")
        setSaving(false)
        return
      }
      
      const { data: newProc, error: createErr } = await createProcedure({
        organizationId: org.id,
        name: customName.trim(),
        code: customCode.trim() || undefined,
        basePrice: priceVal,
      })
      
      if (createErr) {
        setError(createErr)
        setSaving(false)
        return
      }
      
      if (newProc) {
        procId = newProc.id
        procName = newProc.name
        procPrice = newProc.effective_price
        
        const { data: updatedProcs } = await fetchProcedures(activeBranch?.id)
        setProcedures(updatedProcs)
      } else {
        setError("Failed to create procedure.")
        setSaving(false)
        return
      }
    } else {
      const proc = procedures.find((p) => p.id === selectedProc)
      if (!proc) {
        setError("Please select a procedure.")
        setSaving(false)
        return
      }
      procId = proc.id
      procName = proc.name
      procPrice = proc.effective_price
    }
    
    const { error: err } = await addPlanItem({
      planId: activePlanId,
      procedureId: procId,
      description: procName,
      estimatedPrice: procPrice,
      toothNumber: toothNumber || undefined,
    })
    
    if (err) {
      setError(err)
    } else {
      await loadPlan(activePlanId)
      await syncInvoiceIfNeeded()
      setSelectedProc("")
      setIsCustom(false)
      setCustomName("")
      setCustomPrice("")
      setCustomCode("")
      setToothNumber("")
    }
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
    await syncInvoiceIfNeeded()
    setSaving(false)
  }

  const handleUpdateItem = async (
    itemId: string,
    patch: { description: string; estimatedPrice: number; toothNumber: string | null }
  ) => {
    if (!activePlanId) return
    setSaving(true)
    setError(null)
    const { error: err } = await updatePlanItem({
      itemId,
      planId: activePlanId,
      description: patch.description,
      estimatedPrice: patch.estimatedPrice,
      toothNumber: patch.toothNumber,
    })
    if (err) setError(err)
    else {
      await loadPlan(activePlanId)
      await syncInvoiceIfNeeded()
    }
    setSaving(false)
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!activePlanId) return
    setSaving(true)
    setError(null)
    const { error: err } = await deletePlanItem(itemId, activePlanId)
    if (err) setError(err)
    else {
      await loadPlan(activePlanId)
      await syncInvoiceIfNeeded()
    }
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
      setAutoInvoiceId(data.id)
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
                      <TreatmentPlanItemRow
                        key={item.id}
                        item={item}
                        editable={planStatus !== "approved"}
                        saving={saving}
                        onSave={(patch) => handleUpdateItem(item.id, patch)}
                        onDelete={() => handleDeleteItem(item.id)}
                      />
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

            {planStatus !== "approved" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("treatmentPlan.addProcedure", "Add procedure")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    {t("treatmentPlan.quickSelect", "Quick select from templates")}
                  </label>
                  <select
                    onChange={(e) => {
                      const template = PROCEDURE_TEMPLATES.find(t => t.code === e.target.value)
                      if (template) {
                        setIsCustom(true)
                        setSelectedProc("custom")
                        setCustomName(template.name)
                        setCustomPrice(String(template.price))
                        setCustomCode(template.code)
                      } else {
                        setIsCustom(false)
                        setSelectedProc("")
                        setCustomName("")
                        setCustomPrice("")
                        setCustomCode("")
                      }
                    }}
                    className="h-10 w-full rounded-md border border-neutral-300 px-3 text-sm bg-white"
                    value={isCustom ? customCode : ""}
                  >
                    <option value="">{t("treatmentPlan.quickSelectPlaceholder", "Select a template (e.g. crown, veneer, filling…)")}</option>
                    {PROCEDURE_TEMPLATES.map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.name} — ₱{t.price.toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {/* Select Procedure from Catalog */}
                  <div className="flex flex-col gap-1.5 sm:col-span-1">
                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                      Catalog Procedure / Katalog Tedavisi
                    </label>
                    <select
                      value={selectedProc}
                      onChange={(e) => {
                        const val = e.target.value
                        setSelectedProc(val)
                        if (val === "custom") {
                          setIsCustom(true)
                        } else {
                          setIsCustom(false)
                          setCustomName("")
                          setCustomPrice("")
                          setCustomCode("")
                        }
                      }}
                      className="h-10 rounded-md border border-neutral-300 px-3 text-sm bg-white"
                    >
                      <option value="">Select procedure…</option>
                      {procedures.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — ₱{p.effective_price.toLocaleString()}
                        </option>
                      ))}
                      <option value="custom">✍️ Custom Procedure / Yeni Tedavi Ekle</option>
                    </select>
                  </div>

                  {/* Tooth Number */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                      Tooth # / Diş No (Optional)
                    </label>
                    <Input
                      placeholder="e.g. 18, 24, 36"
                      value={toothNumber}
                      onChange={(e) => setToothNumber(e.target.value)}
                      className="h-10"
                    />
                  </div>

                  {/* Add Button */}
                  <div className="flex flex-col gap-1.5 justify-end">
                    <Button
                      onClick={handleAddItem}
                      disabled={saving || (!selectedProc && !isCustom)}
                      className="h-10 gap-2 w-full"
                    >
                      <Plus className="h-4 w-4" /> Add to Plan
                    </Button>
                  </div>
                </div>

                {/* Custom Fields (Shown if isCustom is true) */}
                {isCustom && (
                  <div className="grid gap-3 sm:grid-cols-3 p-4 rounded-lg bg-neutral-50 border border-neutral-100 animate-fade-rise">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-neutral-600">{t("treatmentPlan.customName", "Custom procedure name")}</label>
                      <Input
                        placeholder="e.g. Zirconia Crown"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        className="h-10 bg-white"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-neutral-600">{t("treatmentPlan.customPrice", "Price (₱)")}</label>
                      <Input
                        placeholder="e.g. 2500"
                        type="number"
                        value={customPrice}
                        onChange={(e) => setCustomPrice(e.target.value)}
                        className="h-10 bg-white"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-neutral-600">{t("treatmentPlan.customCode", "Code (optional)")}</label>
                      <Input
                        placeholder="e.g. ZIRC"
                        value={customCode}
                        onChange={(e) => setCustomCode(e.target.value)}
                        className="h-10 bg-white"
                      />
                    </div>
                  </div>
                )}

                {procedures.length === 0 && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-800">
                    <span>Your procedure catalog is empty. You can load default procedures or add custom ones above.</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleSeedDefaults}
                      disabled={seeding}
                      className="bg-white hover:bg-amber-100 border-amber-200 text-amber-900"
                    >
                      {seeding ? "Loading..." : "⚡ Load Default Procedures"}
                    </Button>
                  </div>
                )}

                <ProcedureStockWarningBanner warnings={stockWarnings} />
              </CardContent>
            </Card>
            ) : null}

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
                {t(
                  "treatmentPlan.invoiceLinked",
                  "Invoice draft created from this plan. Collect payment before the patient leaves."
                )}{" "}
                <Link href={`/billing/${autoInvoiceId}`} className="font-medium underline">
                  {t("treatmentPlan.openInvoice", "Open invoice")}
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
