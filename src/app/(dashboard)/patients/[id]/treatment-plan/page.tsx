"use client"

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, CheckCircle, Sparkles, Undo2, Lock, ClipboardList, History, Receipt, Check } from "lucide-react"
import { useLocale } from "@/hooks/use-locale"
import { PatientPageShell } from "@/components/patients/PatientPageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
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
  markTreatmentPlanItemStatus,
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
  createPartialInvoiceFromPlanItems,
  fetchInvoicedItemIdsForPlan,
  type PatientBillingGate,
} from "@/lib/billing/invoice-service"
import { PatientBillingGateBanner } from "@/components/billing/PatientBillingGateBanner"
import { notify } from "@/lib/ui/notify"
import { toast } from "sonner"
import { fetchProcedureStockWarnings } from "@/lib/inventory/inventory-service"
import { ProcedureStockWarningBanner } from "@/components/inventory/ProcedureStockWarningBanner"
import { ChartFindingSuggestionsCard } from "@/components/clinical/ChartFindingSuggestionsCard"
import { TreatmentPlanItemRow } from "@/components/clinical/TreatmentPlanItemRow"
import { TreatmentPlanTimelinePanel } from "@/components/clinical/TreatmentPlanTimelinePanel"
import { toStoredBulletText } from "@/lib/text/bullet-text"
import { cn } from "@/lib/utils"
import {
  centavosToPesoMajor,
  parseMoneyToCentavos,
} from "@/lib/money/php-money"

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

const QUICK_CASE_PROCEDURES = [
  { name: "Oral Examination", defaultPrice: 500, code: "EXAM" },
  { name: "Prophylaxis / Cleaning", defaultPrice: 1000, code: "PROPH" },
  { name: "Composite Filling", defaultPrice: 1200, code: "FILL" },
  { name: "Tooth Extraction", defaultPrice: 1500, code: "EXT" },
  { name: "Root Canal Treatment", defaultPrice: 12000, code: "RCT" },
  { name: "PFM Crown", defaultPrice: 1500, code: "PFM" },
  { name: "Zirconia Crown (Single)", defaultPrice: 15000, code: "ZIRC" },
  { name: "E-Max Veneer", defaultPrice: 15000, code: "EMAX" },
  { name: "Complete Denture (Upper & Lower)", defaultPrice: 20000, code: "DENT" },
]


const PLAN_PHASES = [
  { value: "urgent", label: "Urgent / Emergency", hint: "Acute pain, emergency relief, trauma, or infection" },
  { value: "diagnostic", label: "Diagnostic & Consult", hint: "X-rays, 3D scans, comprehensive exam, specialist consult" },
  { value: "preventive", label: "Preventive & Hygiene", hint: "Cleaning, scaling, fluoride, oral hygiene instruction" },
  { value: "phase_1", label: "Phase 1 – Surgical & Endo", hint: "Extractions, root canal treatments, periodontal surgery" },
  { value: "phase_2", label: "Phase 2 – Restorative", hint: "Composite fillings, inlays, onlays, core build-ups" },
  { value: "phase_3", label: "Phase 3 – Prosthetics & Implants", hint: "Implants, crowns, bridges, dentures, veneers" },
  { value: "phase_4", label: "Phase 4 – Ortho & Aesthetics", hint: "Aligners, braces, whitening, cosmetic bonding" },
  { value: "maintenance", label: "Maintenance & Recall", hint: "Periodic reviews, retainers, prevention" },
] as const

const LEGACY_PHASE_MAP: Record<string, string> = {
  restorative: "phase_2",
  cosmetic: "phase_4",
  ortho: "phase_4",
}

function normalizePlanPhase(value: string | null | undefined) {
  if (!value) return "phase_1"
  return LEGACY_PHASE_MAP[value] ?? value
}

function getPlanPhaseLabel(value: string | null | undefined) {
  const normalized = normalizePlanPhase(value)
  return PLAN_PHASES.find((phase) => phase.value === normalized)?.label ?? "Other"
}

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
  const [itemPhase, setItemPhase] = React.useState("phase_1")
  const [loading, setLoading] = React.useState(!!planId)
  const [mounted, setMounted] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [autoInvoiceId, setAutoInvoiceId] = React.useState<string | null>(null)
  const [invoicedItemsMap, setInvoicedItemsMap] = React.useState<
    Record<string, { invoiceId: string; invoiceNumber: string | null; status: string }>
  >({})

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const [stockWarnings, setStockWarnings] = React.useState<
    { name: string; quantity_on_hand: number; min_stock_level: number }[]
  >([])
  const [riskFlags, setRiskFlags] = React.useState<string[]>([])
  const [seeding, setSeeding] = React.useState(false)
  const [billingGate, setBillingGate] = React.useState<PatientBillingGate | null>(null)
  const [carryPlan, setCarryPlan] = React.useState<CarryForwardPlan | null>(null)
  const [showPlanCarryPicker, setShowPlanCarryPicker] = React.useState(false)
  const [showChartSuggestions, setShowChartSuggestions] = React.useState(false)
  const [noPlanTab, setNoPlanTab] = React.useState<"quick" | "standard">("quick")

  const planEditable = planStatus === "proposed" || planStatus === "draft"

  // Must be declared before any early return (Rules of Hooks)
  const uniqueProcedures = React.useMemo(() => {
    const seen = new Set<string>()
    return (procedures || []).filter((p) => {
      if (!p || !p.name) return false
      const key = `${p.name.trim().toLowerCase()}_${Number(p.base_price || 0)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [procedures])

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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load default procedures")
    } finally {
      setSeeding(false)
    }
  }

  const loadPlan = React.useCallback(async (id: string) => {
    const [result, invoiceResult, invoicedResult] = await Promise.all([
      getTreatmentPlan(id),
      getLinkedInvoiceForPlan(id),
      fetchInvoicedItemIdsForPlan(id),
    ])
    if (result.plan) {
      setPlanTitle(result.plan.title)
      setPlanStatus(result.plan.status)
      setTotal(Number(result.plan.total_estimated))
      setItems((result.items || []).filter((item) => item.plan_id === id))
    }
    setAutoInvoiceId(invoiceResult.data?.id ?? null)
    setInvoicedItemsMap(invoicedResult.data || {})
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
    if (planId) {
      queueMicrotask(() => {
        setActivePlanId(planId)
        setShowChartSuggestions(false)
        void loadPlan(planId)
      })
    } else {
      queueMicrotask(() => {
        setActivePlanId("")
        setItems([])
        setPlanTitle("")
        setPlanStatus("proposed")
        setTotal(0)
        setAutoInvoiceId(null)
        setLoading(false)
      })
    }
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
      queueMicrotask(() => setStockWarnings([]))
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

    const priceCentavos = parseMoneyToCentavos(itemPrice)
    if (priceCentavos === null || priceCentavos < 0) {
      setError(
        t(
          "billing.invalidMoneyAmount",
          "Enter a valid amount in PHP (up to 2 decimal places)."
        )
      )
      notify.error(
        t(
          "billing.invalidMoneyAmount",
          "Enter a valid amount in PHP (up to 2 decimal places)."
        )
      )
      return
    }
    const parsedPrice = centavosToPesoMajor(priceCentavos)

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
      priority: itemPhase,
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
      setItemPhase("phase_1")
    }
    setSaving(false)
  }

  // ─── Quick Case: create plan + add procedure + approve, one shot ────────
  const [qcProc, setQcProc] = React.useState("")
  const [qcPrice, setQcPrice] = React.useState("")
  const [qcTooth, setQcTooth] = React.useState("")
  const [qcNotes, setQcNotes] = React.useState("")
  const [qcCustomName, setQcCustomName] = React.useState("")
  const [qcDate, setQcDate] = React.useState(() => new Date().toISOString().slice(0, 10))
  const [itemDate, setItemDate] = React.useState(() => new Date().toISOString().slice(0, 10))


  const handleQuickCase = async (mode: "bill" | "discharge") => {
    if (!user || !activeBranch) return

    if (!qcProc) {
      notify.error("Select a procedure first.")
      return
    }

    if (qcProc === "custom" && !qcCustomName.trim()) {
      notify.error("Please enter a custom procedure name.")
      return
    }

    const priceCentavos = parseMoneyToCentavos(qcPrice)
    if (!qcPrice.trim() || priceCentavos === null || priceCentavos < 0) {
      notify.error(
        t(
          "billing.invalidMoneyAmount",
          "Enter a valid amount in PHP (up to 2 decimal places)."
        )
      )
      return
    }
    const parsedPrice = centavosToPesoMajor(priceCentavos)

    setSaving(true)
    setError(null)

    const org = await fetchOrganization()
    if (!org) { setError("Organization not found."); setSaving(false); return }

    // 1. Resolve procedure (from catalog, create dynamically if missing, or create custom)
    let procId: string | undefined
    let procName = ""

    if (qcProc === "custom") {
      const { data: newProc, error: createErr } = await createProcedure({
        organizationId: org.id,
        name: qcCustomName.trim(),
        basePrice: parsedPrice,
      })
      if (createErr || !newProc) {
        setError(createErr ?? "Failed to create custom procedure.")
        setSaving(false)
        return
      }
      procId = newProc.id
      procName = newProc.name

      const { data: updatedProcs } = await fetchProcedures(activeBranch.id)
      setProcedures(updatedProcs)
    } else {
      const targetStatic = QUICK_CASE_PROCEDURES.find((sp) => sp.code === qcProc)
      if (!targetStatic) {
        setError("Invalid procedure selected.")
        setSaving(false)
        return
      }

      // Check database if it already exists
      const dbProc = procedures.find(
        (p) => p.code?.toUpperCase() === targetStatic.code.toUpperCase() ||
               p.name.toLowerCase() === targetStatic.name.toLowerCase()
      )

      if (dbProc) {
        procId = dbProc.id
        procName = dbProc.name
      } else {
        // If not in database yet, create it on-the-fly to seed
        const { data: newDbProc, error: seedErr } = await createProcedure({
          organizationId: org.id,
          name: targetStatic.name,
          code: targetStatic.code,
          basePrice: targetStatic.defaultPrice,
        })
        if (seedErr || !newDbProc) {
          setError(seedErr ?? "Failed to register procedure in catalog.")
          setSaving(false)
          return
        }
        procId = newDbProc.id
        procName = newDbProc.name

        const { data: updatedProcs } = await fetchProcedures(activeBranch.id)
        setProcedures(updatedProcs)
      }
    }



    // 2. Resolve encounter
    const encounterId =
      encounterIdParam ??
      (await fetchActiveEncounter(patientId, activeBranch.id)).data?.encounter.id ??
      null

    // 3. Create plan
    const { data: newPlan, error: planErr } = await createTreatmentPlan({
      organizationId: org.id,
      branchId: activeBranch.id,
      patientId,
      title: `${procName} – Quick Case`,
      userId: user.id,
      encounterId,
    })
    if (planErr || !newPlan) {
      setError(planErr ?? "Failed to create plan")
      setSaving(false)
      return
    }

    // 4. Add item
    const notesSuffix = qcNotes.trim() ? `\n${qcNotes.trim()}` : ""
    const { error: itemErr } = await addPlanItem({
      planId: newPlan.id,
      procedureId: procId,
      description: toStoredBulletText(procName + notesSuffix),
      estimatedPrice: parsedPrice,
      toothNumber: qcTooth.trim() || undefined,
      priority: "phase_1",
    })
    if (itemErr) {
      setError(itemErr)
      notify.error(itemErr)
      setSaving(false)
      return
    }

    // 5. Approve (auto-generates draft invoice)
    const { data: approvedPlan, error: approveErr } = await approveTreatmentPlan(newPlan.id)
    if (approveErr || !approvedPlan) {
      setError(approveErr ?? "Approval failed")
      notify.error(approveErr ?? "Approval failed")
      setSaving(false)
      return
    }

    const invoiceId = approvedPlan.invoice_id

    if (mode === "bill" && invoiceId) {
      // Go straight to the invoice to collect payment
      router.push(`/billing/${invoiceId}`)
    } else {
      // Just go back to the patient profile
      notify.success(`${procName} logged & approved.`)
      router.push(`/patients/${patientId}`)
    }
    setSaving(false)
  }
  // ─────────────────────────────────────────────────────────────────────────

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
    patch: { description: string; estimatedPrice: number; toothNumber: string | null; priority?: string }
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
      priority: patch.priority,
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

  const handleMarkItemStatus = async (
    itemId: string,
    status: "planned" | "in_progress" | "completed" | "cancelled"
  ) => {
    setSaving(true)
    setError(null)
    const { error: err } = await markTreatmentPlanItemStatus(itemId, status)
    if (err) {
      setError(err)
      notify.error(err)
    } else if (activePlanId) {
      await loadPlan(activePlanId)
      notify.success(t("treatmentPlan.itemStatusUpdated", "Procedure status updated"))
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

  const handleInvoicePhase = async (phaseLabel: string, phaseItems: typeof planItems) => {
    if (!activePlanId || !activeBranch?.id || !user) return
    const uninvoicedItems = phaseItems.filter(
      (i) => !invoicedItemsMap[i.id] && i.status !== "cancelled"
    )
    if (uninvoicedItems.length === 0) {
      notify.info("All procedures in this phase have already been invoiced.")
      return
    }
    const org = await fetchOrganization()
    if (!org) {
      notify.error("Organization not found.")
      return
    }

    setSaving(true)
    const { data: newInv, error: invErr } = await createPartialInvoiceFromPlanItems({
      organizationId: org.id,
      branchId: activeBranch.id,
      patientId,
      treatmentPlanId: activePlanId,
      items: uninvoicedItems.map((item) => ({
        id: item.id,
        description: `[${phaseLabel}] ${item.description}`,
        estimatedPrice: Number(item.estimated_price) || 0,
        toothNumber: item.tooth_number,
        procedureId: item.procedure_id,
      })),
    })

    if (invErr || !newInv) {
      notify.error(invErr ?? "Failed to create phase invoice.")
      setSaving(false)
      return
    }

    notify.success(`Draft invoice ${newInv.invoiceNumber} created for ${phaseLabel}!`)
    await loadPlan(activePlanId)
    setSaving(false)
    router.push(`/billing/${newInv.id}`)
  }

  const handleInvoiceCompletedItems = async () => {
    if (!activePlanId || !activeBranch?.id || !user) return
    const completedUninvoiced = planItems.filter(
      (i) => i.status === "completed" && !invoicedItemsMap[i.id]
    )
    if (completedUninvoiced.length === 0) {
      notify.info("No completed uninvoiced procedures found.")
      return
    }
    const org = await fetchOrganization()
    if (!org) {
      notify.error("Organization not found.")
      return
    }

    setSaving(true)
    const { data: newInv, error: invErr } = await createPartialInvoiceFromPlanItems({
      organizationId: org.id,
      branchId: activeBranch.id,
      patientId,
      treatmentPlanId: activePlanId,
      items: completedUninvoiced.map((item) => ({
        id: item.id,
        description: item.description,
        estimatedPrice: Number(item.estimated_price) || 0,
        toothNumber: item.tooth_number,
        procedureId: item.procedure_id,
      })),
    })

    if (invErr || !newInv) {
      notify.error(invErr ?? "Failed to create invoice for completed procedures.")
      setSaving(false)
      return
    }

    notify.success(
      `Draft invoice ${newInv.invoiceNumber} created for ${completedUninvoiced.length} completed procedure(s)!`
    )
    await loadPlan(activePlanId)
    setSaving(false)
    router.push(`/billing/${newInv.id}`)
  }

  const handleInvoiceItem = async (item: (typeof planItems)[number]) => {
    if (!activePlanId || !activeBranch?.id || !user) return
    if (invoicedItemsMap[item.id]) {
      notify.info("This procedure is already invoiced.")
      return
    }
    const org = await fetchOrganization()
    if (!org) {
      notify.error("Organization not found.")
      return
    }

    setSaving(true)
    const { data: newInv, error: invErr } = await createPartialInvoiceFromPlanItems({
      organizationId: org.id,
      branchId: activeBranch.id,
      patientId,
      treatmentPlanId: activePlanId,
      items: [
        {
          id: item.id,
          description: item.description,
          estimatedPrice: Number(item.estimated_price) || 0,
          toothNumber: item.tooth_number,
          procedureId: item.procedure_id,
        },
      ],
    })

    if (invErr || !newInv) {
      notify.error(invErr ?? "Failed to create invoice for procedure.")
      setSaving(false)
      return
    }

    notify.success(`Draft invoice ${newInv.invoiceNumber} created for this procedure!`)
    await loadPlan(activePlanId)
    setSaving(false)
    router.push(`/billing/${newInv.id}`)
  }

  if (loading || !mounted) {
    return <PageLoadingSkeleton variant="detail" className="max-w-4xl px-4 py-8" />
  }


  const formatPrice = (val: any) => {
    const num = Number(val)
    return Number.isNaN(num) ? "0" : num.toLocaleString("en-PH")
  }

  const planItems = (items || []).filter(
    (item) => !activePlanId || !item.plan_id || item.plan_id === activePlanId
  )
  const metricItems = activePlanId
    ? [
        { label: "Status", value: planStatus, hint: patientName },
        { label: "Items", value: String(planItems.length), hint: "Procedures on this plan" },
        { label: "Estimated total", value: `₱${formatPrice(total)}`, hint: "Before invoice" },
      ]
    : undefined

  const baseGroups = PLAN_PHASES.map((phase) => {
    const phaseItems = planItems.filter((item) => normalizePlanPhase(item.priority) === phase.value)
    return {
      ...phase,
      items: phaseItems,
      total: phaseItems.reduce((sum, item) => sum + Number(item.estimated_price || 0), 0),
    }
  })
  const otherItems = planItems.filter(
    (item) => !PLAN_PHASES.some((phase) => phase.value === normalizePlanPhase(item.priority))
  )
  const phaseGroups = otherItems.length > 0
    ? [
        ...baseGroups,
        {
          value: "unassigned",
          label: "Unassigned / Other Phase",
          hint: "Procedures without a defined stage",
          items: otherItems,
          total: otherItems.reduce((sum, item) => sum + Number(item.estimated_price || 0), 0),
        }
      ]
    : baseGroups
  const visiblePhaseGroups = planItems.length === 0
    ? []
    : phaseGroups.filter((phase) => phase.items.length > 0)
  const thisPlanNeedsInvoice = Boolean(
    activePlanId &&
      billingGate?.approved_plans_missing_invoice.some((plan) => plan.plan_id === activePlanId)
  )

  return (
    <PermissionGate permission={PERMISSIONS.DENTAL_CHART_WRITE}>
      <PatientPageShell
        patientId={patientId}
        showInlineBack
        section="Treatment plan"
        title={activePlanId && planTitle ? planTitle : "Treatment plan"}
        description={
          activePlanId
            ? t("treatmentPlan.viewThisPlanOnly", "This plan only — history is on the patient file when you need it.")
            : patientName || "Start a blank Quick Case or a new plan — previous visits stay in Treatment History."
        }
        maxWidth="max-w-4xl"
        className="pb-10"
        error={error}
        metrics={metricItems}
        actions={
          activePlanId ? (
            <Button size="sm" variant="outline" className="h-8 gap-1.5" asChild>
              <Link href={`/patients/${patientId}?tab=treatment-history`}>
                <History className="h-3.5 w-3.5" />
                {t("treatmentPlan.openHistory", "Treatment history")}
              </Link>
            </Button>
          ) : null
        }
      >
        {thisPlanNeedsInvoice ? (
          <PatientBillingGateBanner
            gate={billingGate}
            patientId={patientId}
            branchId={activeBranch?.id}
            onBackfill={() => {
              getPatientBillingGate(patientId).then(({ data }) => data && setBillingGate(data))
            }}
          />
        ) : null}
        {activeBranch?.id && !activePlanId ? (
          <TreatmentPlanTimelinePanel
            patientId={patientId}
            branchId={activeBranch.id}
            variant="history"
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
            {carryPlan && !showPlanCarryPicker && carryPlan.itemCount > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => setShowPlanCarryPicker(true)}
              >
                {t("treatmentPlan.copyLastVisit", "Copy last visit plan (optional)")}
              </Button>
            ) : null}
            {/* ── 2-tab plan picker ── */}
            <Card>
              {/* Tab bar */}
              <div className="flex border-b border-neutral-200">
                <button
                  type="button"
                  onClick={() => setNoPlanTab("quick")}
                  className={cn(
                    "flex-1 px-4 py-3 text-sm font-medium text-left transition-colors",
                    noPlanTab === "quick"
                      ? "border-b-2 border-neutral-900 text-neutral-900 bg-white"
                      : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50"
                  )}
                >
                  Quick Case
                  <span className="ml-2 text-xs font-normal text-neutral-400">single visit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNoPlanTab("standard")}
                  className={cn(
                    "flex-1 px-4 py-3 text-sm font-medium text-left transition-colors",
                    noPlanTab === "standard"
                      ? "border-b-2 border-neutral-900 text-neutral-900 bg-white"
                      : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50"
                  )}
                >
                  Standard Plan
                  <span className="ml-2 text-xs font-normal text-neutral-400">multi-phase</span>
                </button>
              </div>

              {/* Tab: Quick Case */}
              {noPlanTab === "quick" && (
                <CardContent className="pt-5 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                        Procedure
                      </label>
                      <select
                        value={qcProc}
                        onChange={(e) => {
                          const val = e.target.value
                          setQcProc(val)
                          const target = QUICK_CASE_PROCEDURES.find((sp) => sp.code === val)
                          if (target) {
                            setQcPrice(String(target.defaultPrice))
                          } else {
                            setQcPrice("")
                          }
                        }}
                        className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400"
                      >
                        <option value="">Select procedure</option>
                        {QUICK_CASE_PROCEDURES.map((p) => (
                          <option key={p.code} value={p.code}>
                            {p.name}
                          </option>
                        ))}
                        <option value="custom">Other / Custom procedure...</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                        Tooth <span className="font-normal normal-case text-neutral-400">(optional)</span>
                      </label>
                      <Input
                        placeholder="e.g. 36"
                        value={qcTooth}
                        onChange={(e) => setQcTooth(e.target.value)}

                        className="h-10"
                      />
                    </div>
                  </div>

                  {qcProc === "custom" && (
                    <div className="flex flex-col gap-1.5 animate-in slide-in-from-top-1 duration-150">
                      <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                        Custom procedure name
                      </label>
                      <Input
                        placeholder="e.g. Laser teeth whitening, Crown cementing..."
                        value={qcCustomName}
                        onChange={(e) => setQcCustomName(e.target.value)}
                        className="h-10"
                      />
                    </div>
                  )}


                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                        Treatment Date
                      </label>
                      <Input
                        type="date"
                        value={qcDate}
                        onChange={(e) => setQcDate(e.target.value)}
                        className="h-10 bg-white"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                        Amount collected (₱)
                      </label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={qcPrice}
                        onChange={(e) => setQcPrice(e.target.value)}
                        className="h-10"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                      Clinical notes <span className="font-normal normal-case text-neutral-400">(optional)</span>
                    </label>
                    <BulletTextarea
                      value={qcNotes}
                      onChange={setQcNotes}
                      placeholder={`e.g.\n• Extraction performed without complications.\n• Patient tolerated the procedure well.`}
                      rows={3}
                      className="bg-white"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      onClick={() => handleQuickCase("bill")}
                      disabled={saving || !qcProc || !qcPrice.trim()}
                    >
                      {saving ? "Saving…" : "Save & go to invoice"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleQuickCase("discharge")}
                      disabled={saving || !qcProc || !qcPrice.trim()}
                    >
                      {saving ? "Saving…" : "Save & return to patient"}
                    </Button>
                  </div>

                  {(!procedures || procedures.length === 0) && (
                    <p className="text-xs text-neutral-500 border border-neutral-200 rounded-md px-3 py-2">
                      No procedures in catalog.{" "}
                      <button
                        type="button"
                        onClick={handleSeedDefaults}
                        disabled={seeding}
                        className="font-semibold underline"
                      >
                        {seeding ? "Loading…" : "Load defaults"}
                      </button>
                    </p>
                  )}
                </CardContent>
              )}

              {/* Tab: Standard Plan */}
              {noPlanTab === "standard" && (
                <CardContent className="pt-5 space-y-3">
                  <p className="text-sm text-neutral-500">
                    Multi-phase plan with individual procedures, tooth assignments, and phased approvals.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={planTitle}
                      onChange={(e) => setPlanTitle(e.target.value)}
                      placeholder="e.g. Restorative Phase 1"
                      className="max-w-sm"
                    />
                    <Button
                      onClick={handleCreatePlanClick}
                      disabled={saving || !planTitle.trim()}
                    >
                      Create plan
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>


          </div>
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <CardTitle>{planTitle}</CardTitle>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <Badge>{planStatus}</Badge>
                    {autoInvoiceId ? (
                      <Button variant="ghost" size="sm" className="h-6 text-xs text-primary-700 px-2" asChild>
                        <Link href={`/billing/${autoInvoiceId}`}>
                          <Receipt className="h-3 w-3 mr-1" /> View Linked Invoice
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col sm:items-end gap-2">
                  <p className="shrink-0 text-lg font-bold">₱{total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p>
                  {planItems.some((i) => i.status === "completed" && !invoicedItemsMap[i.id]) &&
                  (planStatus === "approved" || planStatus === "in_progress" || planStatus === "completed") ? (
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                      disabled={saving}
                      onClick={() => void handleInvoiceCompletedItems()}
                    >
                      <Receipt className="h-3.5 w-3.5" />
                      Invoice Completed (
                      {planItems.filter((i) => i.status === "completed" && !invoicedItemsMap[i.id]).length}) · ₱
                      {formatPrice(
                        planItems
                          .filter((i) => i.status === "completed" && !invoicedItemsMap[i.id])
                          .reduce((sum, i) => sum + (Number(i.estimated_price) || 0), 0)
                      )}
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent>
                {planItems.length === 0 ? (
                  <EmptyState
                    icon={ClipboardList}
                    className="border-0 bg-transparent py-6"
                    title={t("treatmentPlan.noProceduresTitle", "No procedures yet")}
                    description={t("treatmentPlan.noProcedures", "No procedures added yet.")}
                    action={
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/patients/${patientId}/chart`}>
                          {t("treatmentPlan.addFromChart", "Add findings from dental chart")}
                        </Link>
                      </Button>
                    }
                  />
                ) : (
                  <div className="space-y-3">
                    {visiblePhaseGroups.map((phase) => (
                      <section key={phase.value} className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
                        <div className="flex flex-col gap-2 border-b border-neutral-100 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between bg-neutral-50/60">
                          <div>
                            <p className="text-sm font-semibold text-neutral-900">{phase.label}</p>
                            <p className="text-xs text-neutral-500">{phase.hint}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2.5">
                            <div className="text-xs font-semibold text-neutral-600">
                              {phase.items.length} · ₱{formatPrice(phase.total)}
                            </div>
                            {phase.items.length > 0 &&
                            (planStatus === "approved" || planStatus === "in_progress" || planStatus === "completed") ? (
                              (() => {
                                const uninvoiced = phase.items.filter(
                                  (i) => !invoicedItemsMap[i.id] && i.status !== "cancelled"
                                )
                                const uninvoicedTotal = uninvoiced.reduce(
                                  (sum, i) => sum + (Number(i.estimated_price) || 0),
                                  0
                                )
                                if (uninvoiced.length === 0) {
                                  return (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      <Check className="h-3 w-3" /> Invoiced
                                    </span>
                                  )
                                }
                                return (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs px-2.5 gap-1 border-primary-300 text-primary-700 hover:bg-primary-50 bg-white"
                                    disabled={saving}
                                    onClick={() => void handleInvoicePhase(phase.label, phase.items)}
                                  >
                                    <Receipt className="h-3 w-3" />
                                    Invoice Phase · ₱{formatPrice(uninvoicedTotal)}
                                  </Button>
                                )
                              })()
                            ) : null}
                          </div>
                        </div>
                        {phase.items.length === 0 ? (
                          <p className="px-3 py-3 text-xs text-neutral-400">
                            {t("treatmentPlan.noPhaseProcedures", "No procedure in this phase.")}
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left border-collapse">
                              <thead>
                                <tr className="border-b border-neutral-100 bg-neutral-50/50 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                                  <th className="py-2 px-3 w-24">Tooth</th>
                                  <th className="py-2 px-3">Procedure</th>
                                  <th className="py-2 px-3 w-32">Phase</th>
                                  <th className="py-2 px-3 w-28">{t("treatmentPlan.itemStatus", "Status")}</th>
                                  <th className="py-2 px-3 w-28 text-right">Price</th>
                                  <th className="py-2 px-3 w-24 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {phase.items.map((item) => (
                                  <TreatmentPlanItemRow
                                    key={item.id}
                                    item={item}
                                    editable={planEditable}
                                    saving={saving}
                                    phaseOptions={PLAN_PHASES}
                                    phaseLabel={getPlanPhaseLabel}
                                    invoiced={Boolean(invoicedItemsMap[item.id])}
                                    onSave={(patch) => handleUpdateItem(item.id, patch)}
                                    onDelete={() => handleDeleteItem(item.id)}
                                    onMarkStatus={
                                      planStatus === "approved" ||
                                      planStatus === "in_progress" ||
                                      planStatus === "completed"
                                        ? (status) => handleMarkItemStatus(item.id, status)
                                        : undefined
                                    }
                                    onInvoiceItem={
                                      (planStatus === "approved" ||
                                        planStatus === "in_progress" ||
                                        planStatus === "completed") &&
                                      !invoicedItemsMap[item.id]
                                        ? () => void handleInvoiceItem(item)
                                        : undefined
                                    }
                                  />
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </section>
                    ))}
                  </div>
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
                      <h4 className="text-sm font-semibold text-red-900">
                        {t("treatmentPlan.clinicalRiskTitle", "Attention: Clinical safety risk")}
                      </h4>
                      <p className="mt-1 text-sm text-red-800">
                        {t(
                          "treatmentPlan.clinicalRiskIntro",
                          "Critical warnings in the patient's medical history:"
                        )}{" "}
                        <strong>{riskFlags.join(", ")}</strong>.{" "}
                        {t(
                          "treatmentPlan.clinicalRiskOutro",
                          "Review the medical history in detail before planning surgical procedures."
                        )}
                      </p>
                    </div>
                  </div>
                )}
                {showChartSuggestions ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8"
                      onClick={() => setShowChartSuggestions(false)}
                    >
                      {t("treatmentPlan.hideChartSuggestions", "Hide chart findings")}
                    </Button>
                    <ChartFindingSuggestionsCard
                      patientId={patientId}
                      branchId={activeBranch?.id ?? null}
                      procedures={procedures}
                      planItems={planItems}
                      onAddAll={() => void handleBulkFromChart()}
                      saving={saving}
                      disabled={!activePlanId}
                    />
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => setShowChartSuggestions(true)}
                  >
                    {t("treatmentPlan.showChartSuggestions", "Show chart findings (optional)")}
                  </Button>
                )}
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

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                      { (procedures || []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                      <option value="custom">{t("treatmentPlan.customProcedure", "Custom procedure")}</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                      Phase
                    </label>
                    <select
                      value={itemPhase}
                      onChange={(e) => setItemPhase(e.target.value)}
                      className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
                    >
                      {PLAN_PHASES.map((phase) => (
                        <option key={phase.value} value={phase.value}>
                          {phase.label}
                        </option>
                      ))}
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
                      Procedure Date
                    </label>
                    <Input
                      type="date"
                      value={itemDate}
                      onChange={(e) => setItemDate(e.target.value)}
                      className="h-10 bg-white"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                      {t("treatmentPlan.patientPrice", "Patient price (₱)")}
                    </label>
                    <Input
                      type="text"
                      inputMode="decimal"
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
                      className="h-10 gap-2 w-full bg-teal-600 hover:bg-teal-700 text-white"
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

                {(!procedures || procedures.length === 0) && (
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
                <Button onClick={handleApprove} disabled={saving || planItems.length === 0} className="gap-2">
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
