"use client"

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, CheckCircle, Sparkles, Undo2, Lock } from "lucide-react"
import { useLocale } from "@/hooks/use-locale"
import { PatientPageShell } from "@/components/patients/PatientPageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { BulletTextarea } from "@/components/ui/BulletTextarea"
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
  unapproveTreatmentPlan,
  bulkAddChartFindingsToPlan,
  updatePlanItem,
  deletePlanItem,
  duplicatePlanItemsFromPlan,
} from "@/lib/clinical/treatment-plan-service"
import { fetchActiveEncounter } from "@/lib/clinical/encounter-service"
import {
  fetchCarryForwardSources,
  type CarryForwardPlan,
} from "@/lib/clinical/encounter-carry-forward"
import { EncounterCarryForwardPicker } from "@/components/clinical/EncounterCarryForwardPicker"
import {
  getLinkedInvoiceForPlan,
  resyncDraftInvoiceFromPlan,
  backfillPatientPlanInvoices,
  getPatientBillingGate,
  type PatientBillingGate,
} from "@/lib/billing/invoice-service"
import { PatientBillingGateBanner } from "@/components/billing/PatientBillingGateBanner"
import { notify } from "@/lib/ui/notify"
import { toast } from "sonner"
import { fetchProcedureStockWarnings } from "@/lib/inventory/inventory-service"
import { ProcedureStockWarningBanner } from "@/components/inventory/ProcedureStockWarningBanner"
import { ChartFindingSuggestionsCard } from "@/components/clinical/ChartFindingSuggestionsCard"
import { TreatmentPlanItemRow } from "@/components/clinical/TreatmentPlanItemRow"
import { toStoredBulletText } from "@/lib/text/bullet-text"

const PROCEDURE_TEMPLATES = [
  { code: "EXAM", name: "Oral Examination" },
  { code: "PROPH", name: "Prophylaxis / Cleaning" },
  { code: "FILL", name: "Composite Filling" },
  { code: "RCT", name: "Root Canal Treatment" },
  { code: "EXT", name: "Tooth Extraction" },
  { code: "CRWN", name: "Jacket Crown" },
  { code: "PFM", name: "PFM Crown" },
  { code: "ZIRC", name: "Zirconia Crown (Single)" },
  { code: "EMAX", name: "E-Max Veneer" },
  { code: "NG", name: "Nightguard (Hard/Soft)" },
  { code: "DENT", name: "Complete Denture (Upper & Lower)" },
]

function TreatmentPlanContent() {
  const { id: patientId } = useRouteParams<{ id: string }>()
  const searchParams = useSearchParams()
  const planId = searchParams.get("plan")
  const encounterIdParam = searchParams.get("encounter")
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
  const [customCode, setCustomCode] = React.useState("")
  const [itemPrice, setItemPrice] = React.useState("")
  const [loading, setLoading] = React.useState(!!planId)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [autoInvoiceId, setAutoInvoiceId] = React.useState<string | null>(null)
  const [stockWarnings, setStockWarnings] = React.useState<
    { name: string; quantity_on_hand: number; min_stock_level: number }[]
  >([])
  const [riskFlags, setRiskFlags] = React.useState<string[]>([])
  const [seeding, setSeeding] = React.useState(false)
  const [billingGate, setBillingGate] = React.useState<PatientBillingGate | null>(null)
  const [carryPlan, setCarryPlan] = React.useState<CarryForwardPlan | null>(null)
  const [showPlanCarryPicker, setShowPlanCarryPicker] = React.useState(true)

  const planEditable = planStatus === "proposed" || planStatus === "draft"

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
    if (!activePlanId || !planEditable) return
    let invoiceId = autoInvoiceId
    if (!invoiceId) {
      const { data } = await getLinkedInvoiceForPlan(activePlanId)
      if (!data || data.status !== "draft") return
      invoiceId = data.id
      setAutoInvoiceId(data.id)
    }
    const { error: syncErr } = await resyncDraftInvoiceFromPlan(invoiceId, activePlanId)
    if (syncErr) setError(syncErr)
  }, [autoInvoiceId, activePlanId, planEditable])

  React.useEffect(() => {
    getPatient(patientId).then(({ data }) => {
      if (data) setPatientName(`${data.first_name} ${data.last_name}`)
    })
    getMedicalRiskFlags(patientId).then(({ data }) => {
      if (data) setRiskFlags(data.flags.map((flag) => flag.label))
    })
    getPatientBillingGate(patientId).then(({ data }) => {
      if (data) setBillingGate(data)
    })
    fetchProcedures(activeBranch?.id).then(({ data }) => setProcedures(data))
    if (planId) loadPlan(planId)
    else setLoading(false)
  }, [patientId, planId, loadPlan, activeBranch?.id])

  React.useEffect(() => {
    if (!activeBranch?.id || planId) return
    void (async () => {
      const { data: activeEnc } = await fetchActiveEncounter(patientId, activeBranch.id)
      const { data } = await fetchCarryForwardSources(patientId, activeBranch.id, {
        excludeEncounterId: activeEnc?.encounter.id,
      })
      setCarryPlan(data.plan)
    })()
  }, [patientId, activeBranch?.id, planId])

  React.useEffect(() => {
    if (!activeBranch?.id || !selectedProc) {
      setStockWarnings([])
      return
    }
    fetchProcedureStockWarnings(activeBranch.id, selectedProc).then(({ data }) => {
      setStockWarnings(data)
    })
  }, [activeBranch?.id, selectedProc])

  const handleCreatePlan = async (options?: { copyFromPlanId?: string; titleOverride?: string }) => {
    if (!user || !activeBranch) return
    const title = (options?.titleOverride ?? planTitle).trim()
    if (!title) return
    setSaving(true)
    const org = await fetchOrganization()
    if (!org) { setError("Org not found"); setSaving(false); return }

    const encounterId =
      encounterIdParam ??
      (activeBranch
        ? (await fetchActiveEncounter(patientId, activeBranch.id)).data?.encounter.id ?? null
        : null)

    const { data, error: err } = await createTreatmentPlan({
      organizationId: org.id,
      branchId: activeBranch.id,
      patientId,
      title,
      userId: user.id,
      encounterId,
    })
    if (err || !data) {
      setSaving(false)
      setError(err ?? "Failed")
      return
    }

    if (options?.copyFromPlanId) {
      const { error: copyErr } = await duplicatePlanItemsFromPlan(options.copyFromPlanId, data.id)
      if (copyErr) {
        setSaving(false)
        setError(copyErr)
        return
      }
    }

    setSaving(false)
    setShowPlanCarryPicker(false)
    setActivePlanId(data.id)
    router.replace(`/patients/${patientId}/treatment-plan?plan=${data.id}`)
  }

  const handleCreatePlanClick = () => {
    void handleCreatePlan()
  }

  const handleCopyPlanFromLastVisit = () => {
    if (!carryPlan) return
    const title = planTitle.trim() || `${carryPlan.title} (continued)`
    setPlanTitle(title)
    void handleCreatePlan({ copyFromPlanId: carryPlan.planId, titleOverride: title })
  }

  const handleAddItem = async () => {
    if (!activePlanId) return

    if (itemPrice.trim() === "") {
      setError(t("treatmentPlan.priceRequired", "Enter the patient-specific price for this procedure."))
      notify.error(t("treatmentPlan.priceRequired", "Enter the patient-specific price for this procedure."))
      return
    }

    const parsedPrice = parseFloat(itemPrice)
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setError(t("treatmentPlan.priceInvalid", "Enter a valid price (0 or greater)."))
      notify.error(t("treatmentPlan.priceInvalid", "Enter a valid price (0 or greater)."))
      return
    }

    setSaving(true)
    setError(null)

    let procId: string | undefined = undefined
    let procName = ""

    if (selectedProc === "custom" || isCustom) {
      if (!customName.trim()) {
        setError("Please enter a procedure name.")
        setSaving(false)
        return
      }

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
        basePrice: 0,
      })

      if (createErr) {
        setError(createErr)
        setSaving(false)
        return
      }

      if (newProc) {
        procId = newProc.id
        procName = newProc.name

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
    }

    const descriptionSource = selectedProc === "custom" || isCustom ? customName : procName

    const { error: err } = await addPlanItem({
      planId: activePlanId,
      procedureId: procId,
      description: toStoredBulletText(descriptionSource),
      estimatedPrice: parsedPrice,
      toothNumber: toothNumber || undefined,
    })

    if (err) {
      setError(err)
      notify.error(err)
    } else {
      await loadPlan(activePlanId)
      await syncInvoiceIfNeeded()
      notify.success(t("treatmentPlan.itemAdded", "Procedure added"))
      setSelectedProc("")
      setIsCustom(false)
      setCustomName("")
      setCustomCode("")
      setItemPrice("")
      setToothNumber("")
    }
    setSaving(false)
  }

  const handleBulkFromChart = async () => {
    if (!activePlanId) return
    setSaving(true)
    setError(null)
    const { data, error: err } = await bulkAddChartFindingsToPlan(activePlanId)
    if (err) {
      setError(err)
      notify.error(err)
    } else if (data && data.added === 0) {
      const msg = "No chart findings matched procedures for this plan."
      setError(msg)
      notify.info(msg)
    } else if (data && data.added > 0) {
      notify.success(t("treatmentPlan.itemsFromChart", "Added {count} procedure(s) from chart").replace("{count}", String(data.added)))
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
    if (err) {
      setError(err)
      notify.error(err)
    } else {
      await loadPlan(activePlanId)
      await syncInvoiceIfNeeded()
      notify.success(t("treatmentPlan.itemUpdated", "Procedure updated"))
    }
    setSaving(false)
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!activePlanId) return
    setSaving(true)
    setError(null)
    const { error: err } = await deletePlanItem(itemId, activePlanId)
    if (err) {
      setError(err)
      notify.error(err)
    } else {
      await loadPlan(activePlanId)
      await syncInvoiceIfNeeded()
      notify.success(t("treatmentPlan.itemRemoved", "Procedure removed"))
    }
    setSaving(false)
  }

  const handleApprove = async () => {
    if (!activePlanId) return
    setSaving(true)
    setError(null)
    const { data, error: err } = await approveTreatmentPlan(activePlanId)
    if (err) {
      setError(err)
      notify.error(err)
    } else if (data) {
      setPlanStatus(data.status)
      setTotal(data.total_estimated)
      setAutoInvoiceId(data.invoice_id)
      if (data.invoice_id) {
        toast.success(t("treatmentPlan.approvedWithInvoice", "Treatment plan approved — invoice draft created"), {
          action: {
            label: t("treatmentPlan.viewInvoice", "View invoice"),
            onClick: () => router.push(`/billing/${data.invoice_id}`),
          },
        })
      } else {
        notify.success(t("treatmentPlan.approved", "Treatment plan approved"))
      }
    }
    await loadPlan(activePlanId)
    setSaving(false)
  }

  const handleUnapprove = async () => {
    if (!activePlanId) return
    const confirmed = await notify.confirm(
      t(
        "treatmentPlan.unapproveConfirm",
        "Unapprove this plan? The linked draft invoice will be voided and you can edit procedures again."
      )
    )
    if (!confirmed) return
    setSaving(true)
    setError(null)
    const { data, error: err } = await unapproveTreatmentPlan(activePlanId)
    if (err) {
      setError(err)
      notify.error(err)
    } else if (data) {
      setPlanStatus(data.status)
      setAutoInvoiceId(null)
      notify.success(t("treatmentPlan.unapproved", "Plan approval removed — you can edit procedures again"))
    }
    await loadPlan(activePlanId)
    setSaving(false)
  }

  const handleBackfillInvoice = async () => {
    if (!activeBranch) return
    setSaving(true)
    setError(null)
    const { data, error: err } = await backfillPatientPlanInvoices({
      patientId,
      branchId: activeBranch.id,
    })
    if (err) {
      setError(err)
      notify.error(err)
    } else if (data && data.created > 0) {
      const { data: linked } = await getLinkedInvoiceForPlan(activePlanId!)
      if (linked) setAutoInvoiceId(linked.id)
      notify.success(
        t("billing.gateBackfillDone", "Created {count} draft invoice(s).").replace(
          "{count}",
          String(data.created)
        )
      )
    } else {
      const msg = t("treatmentPlan.noInvoiceBackfill", "No missing invoices to create.")
      setError(msg)
      notify.info(msg)
    }
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
        {billingGate?.has_billing_gap ? (
          <PatientBillingGateBanner
            gate={billingGate}
            patientId={patientId}
            branchId={activeBranch?.id}
            onBackfill={() => {
              getPatientBillingGate(patientId).then(({ data }) => data && setBillingGate(data))
            }}
          />
        ) : null}
        {!activePlanId ? (
          <div className="space-y-4">
            {carryPlan && showPlanCarryPicker && carryPlan.itemCount > 0 ? (
              <EncounterCarryForwardPicker
                kind="plan"
                source={carryPlan}
                loading={saving}
                onCopy={handleCopyPlanFromLastVisit}
                onBlank={() => {
                  setShowPlanCarryPicker(false)
                }}
                onDismiss={() => setShowPlanCarryPicker(false)}
              />
            ) : null}
            <Card>
              <CardHeader>
                <CardTitle>New Treatment Plan</CardTitle>
                <CardDescription>Create a proposed treatment plan for this patient.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input value={planTitle} onChange={(e) => setPlanTitle(e.target.value)} placeholder="e.g. Restorative Phase 1" />
                <Button onClick={handleCreatePlanClick} disabled={saving || !planTitle.trim()}>Create Plan</Button>
              </CardContent>
            </Card>
          </div>
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
                        editable={planEditable}
                        saving={saving}
                        onSave={(patch) => handleUpdateItem(item.id, patch)}
                        onDelete={() => handleDeleteItem(item.id)}
                      />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {planStatus === "approved" || planStatus === "in_progress" ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-sm text-blue-950 space-y-2">
                <div className="flex gap-2">
                  <Lock className="h-5 w-5 shrink-0 text-blue-600" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-semibold">
                      {t("treatmentPlan.approvedLockedTitle", "Plan approved — procedures locked")}
                    </p>
                    <p className="text-blue-900/90">
                      {t(
                        "treatmentPlan.approvedLockedHint",
                        "To change procedures or prices, unapprove the plan first. For minor billing adjustments, edit the linked invoice in Billing."
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pl-7">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-blue-300"
                    onClick={() => void handleUnapprove()}
                    disabled={saving}
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                    {t("treatmentPlan.unapprove", "Unapprove plan")}
                  </Button>
                  {autoInvoiceId ? (
                    <Button type="button" size="sm" variant="outline" asChild>
                      <Link href={`/billing/${autoInvoiceId}`}>
                        {t("treatmentPlan.editInvoiceInstead", "Edit invoice instead")}
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {planEditable ? (
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

            {planEditable ? (
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
                      const template = PROCEDURE_TEMPLATES.find((tpl) => tpl.code === e.target.value)
                      if (template) {
                        setIsCustom(true)
                        setSelectedProc("custom")
                        setCustomName(template.name)
                        setCustomCode(template.code)
                      } else {
                        setIsCustom(false)
                        setSelectedProc("")
                        setCustomName("")
                        setCustomCode("")
                      }
                    }}
                    className="h-10 w-full rounded-md border border-neutral-300 px-3 text-sm bg-white"
                    value={isCustom ? customCode : ""}
                  >
                    <option value="">{t("treatmentPlan.quickSelectPlaceholder", "Select a template (e.g. crown, veneer, filling…)")}</option>
                    {PROCEDURE_TEMPLATES.map((tpl) => (
                      <option key={tpl.code} value={tpl.code}>
                        {tpl.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                      {t("treatmentPlan.catalogProcedure", "Catalog procedure")}
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
                          setCustomCode("")
                        }
                      }}
                      className="h-10 rounded-md border border-neutral-300 px-3 text-sm bg-white"
                    >
                      <option value="">{t("treatmentPlan.selectProcedure", "Select procedure…")}</option>
                      {procedures.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                      <option value="custom">{t("treatmentPlan.customProcedure", "Custom procedure")}</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                      {t("treatmentPlan.toothNumber", "Tooth # (optional)")}
                    </label>
                    <Input
                      placeholder="e.g. 18, 24, 36"
                      value={toothNumber}
                      onChange={(e) => setToothNumber(e.target.value)}
                      className="h-10"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                      {t("treatmentPlan.patientPrice", "Patient price (₱)")}
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g. 2500"
                      value={itemPrice}
                      onChange={(e) => setItemPrice(e.target.value)}
                      className="h-10"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 justify-end">
                    <Button
                      onClick={handleAddItem}
                      disabled={saving || (!selectedProc && !isCustom)}
                      className="h-10 gap-2 w-full"
                    >
                      <Plus className="h-4 w-4" /> {t("treatmentPlan.addToPlan", "Add to plan")}
                    </Button>
                  </div>
                </div>

                {isCustom ? (
                  <div className="grid gap-3 p-4 rounded-lg bg-neutral-50 border border-neutral-100 animate-fade-rise sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label className="text-xs font-semibold text-neutral-600">
                        {t("treatmentPlan.customName", "Procedure details")}
                      </label>
                      <BulletTextarea
                        value={customName}
                        onChange={setCustomName}
                        rows={4}
                        placeholder={`e.g.\n• Zirconia crown #24\n• Temporary crown`}
                        className="bg-white"
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
                ) : null}

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
              {planEditable ? (
                <Button variant="outline" onClick={handleBulkFromChart} disabled={saving} className="gap-2">
                  <Sparkles className="h-4 w-4" /> Add from chart findings
                </Button>
              ) : null}
              {planEditable ? (
                <Button onClick={handleApprove} disabled={saving || items.length === 0} className="gap-2">
                  <CheckCircle className="h-4 w-4" /> Approve Plan
                </Button>
              ) : null}
              {(planStatus === "approved" || planStatus === "in_progress") && !autoInvoiceId ? (
                <Button variant="default" onClick={handleBackfillInvoice} disabled={saving}>
                  {t("treatmentPlan.createMissingInvoice", "Create invoice from plan")}
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
