"use client"

import * as React from "react"
import Link from "next/link"
import {
  Plus,
  Printer,
  Save,
  PenLine,
  Trash2,
  Pill,
  AlertTriangle,
  ChevronRight,
} from "lucide-react"
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
import { getLatestMedicalHistory } from "@/lib/patients/medical-history-service"
import { MedicalAlertBanner } from "@/components/patients/MedicalAlertBanner"
import { BulletTextarea } from "@/components/ui/BulletTextarea"
import {
  COMMON_DENTAL_MEDS,
  fetchPatientPrescriptions,
  getPrescription,
  savePrescriptionDraft,
  signPrescription,
  voidPrescription,
  type PrescriptionItem,
  type PrescriptionRecord,
} from "@/lib/clinical/prescription-service"
import { buildPrescriptionPrintHtml, printPrescription } from "@/lib/clinical/prescription-print"
import { toast } from "sonner"

function formatPatientGender(gender: string | null | undefined): string | null {
  if (!gender || gender === "prefer_not_to_say") return null
  if (gender === "male") return "Male"
  if (gender === "female") return "Female"
  return gender
}

const EMPTY_ITEM = (): Omit<PrescriptionItem, "id" | "sort_order"> => ({
  drug_name: "",
  strength: "",
  dosage: "",
  frequency: "",
  duration: "",
  quantity: "",
  instructions: "",
})

export default function PrescriptionsPage() {
  const { id: patientId } = useRouteParams<{ id: string }>()
  const { user } = useAuth()
  const { activeBranch } = useBranch()
  const { hasPermission } = usePermission()
  const canWrite = hasPermission(PERMISSIONS.PRESCRIPTIONS_WRITE)

  const [patientName, setPatientName] = React.useState("")
  const [patientDob, setPatientDob] = React.useState<string | null>(null)
  const [patientSex, setPatientSex] = React.useState<string | null>(null)
  const [medicalHistory, setMedicalHistory] = React.useState<Awaited<
    ReturnType<typeof getLatestMedicalHistory>
  >["data"]>(null)
  const [history, setHistory] = React.useState<PrescriptionRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const [draftId, setDraftId] = React.useState<string | undefined>()
  const [diagnosis, setDiagnosis] = React.useState("")
  const [generalInstructions, setGeneralInstructions] = React.useState("")
  const [items, setItems] = React.useState([EMPTY_ITEM()])
  const [viewRxId, setViewRxId] = React.useState<string | null>(null)
  const [viewRx, setViewRx] = React.useState<PrescriptionRecord | null>(null)

  const loadHistory = React.useCallback(async () => {
    if (!activeBranch) return
    const { data, error: err } = await fetchPatientPrescriptions(patientId, activeBranch.id)
    setHistory(data)
    if (err) setError(err)
    setLoading(false)
  }, [activeBranch, patientId])

  React.useEffect(() => {
    getPatient(patientId).then(({ data }) => {
      if (data) {
        setPatientName(`${data.first_name} ${data.last_name}`)
        setPatientDob(data.date_of_birth)
        setPatientSex(formatPatientGender(data.gender))
      }
    })
    getLatestMedicalHistory(patientId).then(({ data }) => setMedicalHistory(data))
    loadHistory()
  }, [patientId, loadHistory])

  React.useEffect(() => {
    if (!viewRxId) {
      setViewRx(null)
      return
    }
    getPrescription(viewRxId).then(({ data }) => setViewRx(data))
  }, [viewRxId])

  const resetDraft = () => {
    setDraftId(undefined)
    setDiagnosis("")
    setGeneralInstructions("")
    setItems([EMPTY_ITEM()])
    setViewRxId(null)
  }

  const updateItem = (index: number, patch: Partial<Omit<PrescriptionItem, "id" | "sort_order">>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  const addItem = () => setItems((prev) => [...prev, EMPTY_ITEM()])

  const removeItem = (index: number) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  const applyTemplate = (index: number, template: (typeof COMMON_DENTAL_MEDS)[number]) => {
    updateItem(index, { ...template })
  }

  const handleSaveDraft = async (andSign = false) => {
    if (!user || !activeBranch) return
    const validItems = items.filter((i) => i.drug_name.trim())
    if (validItems.length === 0) {
      setError("Add at least one medication")
      return
    }
    setSaving(true)
    setError(null)
    const org = await fetchOrganization()
    if (!org) {
      setSaving(false)
      setError("Organization not found")
      return
    }
    const { data, error: saveErr } = await savePrescriptionDraft({
      id: draftId,
      organizationId: org.id,
      branchId: activeBranch.id,
      patientId,
      diagnosis,
      generalInstructions,
      items: validItems,
    })
    if (saveErr || !data) {
      setSaving(false)
      setError(saveErr ?? "Could not save")
      return
    }
    setDraftId(data.id)
    if (andSign) {
      const { error: signErr } = await signPrescription(data.id)
      setSaving(false)
      if (signErr) {
        setError(signErr)
        return
      }
      toast.success("Prescription signed")
      resetDraft()
      await loadHistory()
    } else {
      setSaving(false)
      toast.success("Draft saved")
      await loadHistory()
    }
  }

  const handlePrint = async (rx: PrescriptionRecord) => {
    const full = rx.items ? rx : (await getPrescription(rx.id)).data
    if (!full?.items?.length) return
    const org = await fetchOrganization()
    const age = patientDob
      ? String(new Date().getFullYear() - new Date(patientDob).getFullYear())
      : null
    const html = buildPrescriptionPrintHtml({
      prescription: full,
      items: full.items,
      patientName,
      patientAge: age,
      patientSex,
      clinicName: org?.name ?? "Dental Clinic",
      clinicAddress: org?.address,
      clinicPhone: org?.contact_number,
      branchName: activeBranch?.name,
      allergies: medicalHistory?.allergies ?? [],
      medications: medicalHistory?.medications ?? [],
    })
    printPrescription(html)
  }

  const handleVoid = async (rxId: string) => {
    if (!confirm("Void this prescription?")) return
    const { error: err } = await voidPrescription(rxId, "Voided by clinician")
    if (err) setError(err)
    else {
      toast.success("Prescription voided")
      if (viewRxId === rxId) setViewRxId(null)
      await loadHistory()
    }
  }

  return (
    <PermissionGate permission={PERMISSIONS.PRESCRIPTIONS_READ}>
      <PatientPageShell
        patientId={patientId}
        section="Prescriptions"
        title="Prescriptions"
        description={`${patientName}${activeBranch ? ` · ${activeBranch.name}` : ""}`}
        maxWidth="max-w-5xl"
        error={error}
        onRetry={loadHistory}
        panel={false}
      >
        {loading ? (
          <PageLoadingSkeleton variant="inline" />
        ) : (
          <div className="space-y-6">
            <MedicalAlertBanner
              alerts={
                medicalHistory
                  ? {
                      allergies: medicalHistory.allergies,
                      conditions: medicalHistory.conditions,
                      medications: medicalHistory.medications,
                    }
                  : null
              }
              editHref={`/patients/${patientId}/medical-history`}
            />

            {canWrite ? (
              <Card className="border-primary-200/60">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Pill className="h-4 w-4 text-primary-600" />
                    New prescription
                  </CardTitle>
                  <CardDescription>
                    Dental formulary shortcuts, allergy-aware. Sign when ready to print for the patient.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-neutral-600">Diagnosis / indication</label>
                    <Input
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      placeholder="e.g. Post-extraction prophylaxis"
                    />
                  </div>
                  <BulletTextarea
                    value={generalInstructions}
                    onChange={setGeneralInstructions}
                    placeholder="Patient instructions (one per line or use bullets)"
                    rows={3}
                  />
                  <div className="space-y-3">
                    {items.map((item, index) => (
                      <div
                        key={index}
                        className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-3 space-y-2"
                      >
                        <div className="flex flex-wrap gap-2">
                          {COMMON_DENTAL_MEDS.map((tmpl) => (
                            <Button
                              key={tmpl.drug_name}
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => applyTemplate(index, tmpl)}
                            >
                              {tmpl.drug_name}
                            </Button>
                          ))}
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <Input
                            placeholder="Drug name *"
                            value={item.drug_name}
                            onChange={(e) => updateItem(index, { drug_name: e.target.value })}
                          />
                          <Input
                            placeholder="Strength"
                            value={item.strength ?? ""}
                            onChange={(e) => updateItem(index, { strength: e.target.value })}
                          />
                          <Input
                            placeholder="Dosage"
                            value={item.dosage ?? ""}
                            onChange={(e) => updateItem(index, { dosage: e.target.value })}
                          />
                          <Input
                            placeholder="Frequency"
                            value={item.frequency ?? ""}
                            onChange={(e) => updateItem(index, { frequency: e.target.value })}
                          />
                          <Input
                            placeholder="Duration"
                            value={item.duration ?? ""}
                            onChange={(e) => updateItem(index, { duration: e.target.value })}
                          />
                          <Input
                            placeholder="Quantity"
                            value={item.quantity ?? ""}
                            onChange={(e) => updateItem(index, { quantity: e.target.value })}
                          />
                        </div>
                        <Input
                          placeholder="Sig / special instructions"
                          value={item.instructions ?? ""}
                          onChange={(e) => updateItem(index, { instructions: e.target.value })}
                        />
                        {items.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-600 gap-1"
                            onClick={() => removeItem(index)}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remove line
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addItem}>
                      <Plus className="h-4 w-4" /> Add medication
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      disabled={saving}
                      onClick={() => void handleSaveDraft(false)}
                    >
                      <Save className="h-4 w-4" /> Save draft
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1"
                      disabled={saving}
                      onClick={() => void handleSaveDraft(true)}
                    >
                      <PenLine className="h-4 w-4" /> Sign &amp; finish
                    </Button>
                  </div>
                  {(medicalHistory?.allergies?.length ?? 0) > 0 ? (
                    <p className="text-xs text-amber-800 flex items-center gap-1 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      Review allergies before signing: {medicalHistory?.allergies?.join(", ")}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Prescription history</CardTitle>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="text-sm text-neutral-500 py-6 text-center">No prescriptions yet.</p>
                ) : (
                  <ul className="divide-y">
                    {history.map((rx) => (
                      <li key={rx.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm">
                            {rx.diagnosis ?? "Prescription"}{" "}
                            <Badge variant={rx.status === "signed" ? "success" : "default"} className="ml-1 text-[10px]">
                              {rx.status}
                            </Badge>
                          </p>
                          <p className="text-xs text-neutral-500">
                            {new Date(rx.signed_at ?? rx.created_at).toLocaleString("en-PH")}
                            {rx.prescriber_name ? ` · ${rx.prescriber_name}` : ""}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {rx.status === "signed" ? (
                            <Button size="sm" variant="outline" className="gap-1" onClick={() => void handlePrint(rx)}>
                              <Printer className="h-3.5 w-3.5" /> Print
                            </Button>
                          ) : null}
                          {rx.status === "draft" && canWrite ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-primary-700 hover:text-primary-800"
                              onClick={() => {
                                setDraftId(rx.id)
                                setDiagnosis(rx.diagnosis ?? "")
                                setGeneralInstructions(rx.general_instructions ?? "")
                                getPrescription(rx.id).then(({ data }) => {
                                  if (data?.items) {
                                    setItems(data.items.map((i) => ({
                                      drug_name: i.drug_name || "",
                                      strength: i.strength || "",
                                      dosage: i.dosage || "",
                                      frequency: i.frequency || "",
                                      duration: i.duration || "",
                                      quantity: i.quantity || "",
                                      instructions: i.instructions || "",
                                    })))
                                  }
                                })
                              }}
                            >
                              Edit draft
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1"
                            onClick={() => {
                              setViewRxId(rx.id)
                              // Immediately pre-populate viewRx from list data to prevent flashing blank details
                              setViewRx(rx)
                            }}
                          >
                            View <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                          {canWrite && rx.status !== "voided" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => void handleVoid(rx.id)}
                            >
                              Void
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>            {viewRx ? (
              <Card className="border-neutral-200 shadow-sm animate-fade-rise">
                <CardHeader className="bg-neutral-50/50 border-b border-neutral-100 flex flex-row items-center justify-between py-3">
                  <div>
                    <CardTitle className="text-base">Prescription Details</CardTitle>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {new Date(viewRx.signed_at ?? viewRx.created_at).toLocaleString("en-PH")}
                      {viewRx.prescriber_name ? ` · Prescribed by ${viewRx.prescriber_name}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={viewRx.status === "signed" ? "success" : viewRx.status === "voided" ? "danger" : "default"}>
                      {viewRx.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4 text-sm">
                  {viewRx.diagnosis && (
                    <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-100">
                      <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Diagnosis / Indication:</span>
                      <p className="font-medium text-neutral-800 mt-1">{viewRx.diagnosis}</p>
                    </div>
                  )}

                  {viewRx.general_instructions && (
                    <div className="bg-primary-50/20 rounded-lg p-3 border border-primary-100">
                      <span className="text-xs font-semibold text-primary-700 uppercase tracking-wide">Patient Instructions:</span>
                      <div className="text-neutral-700 mt-1 whitespace-pre-line text-xs leading-relaxed">
                        {viewRx.general_instructions}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Prescribed Medications:</span>
                    <div className="space-y-2">
                      {viewRx.items && viewRx.items.length > 0 ? (
                        viewRx.items.map((item, i) => (
                          <div key={item.id ?? i} className="rounded-lg border border-neutral-200 bg-white p-3 shadow-2xs">
                            <p className="font-semibold text-neutral-900">
                              {i + 1}. {item.drug_name} {item.strength ? `(${item.strength})` : ""}
                            </p>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-neutral-600 text-xs mt-1">
                              {item.dosage && <span><strong>Dosage:</strong> {item.dosage}</span>}
                              {item.frequency && <span><strong>Frequency:</strong> {item.frequency}</span>}
                              {item.duration && <span><strong>Duration:</strong> {item.duration}</span>}
                              {item.quantity && <span><strong>Qty:</strong> {item.quantity}</span>}
                            </div>
                            {item.instructions ? (
                              <p className="text-neutral-500 text-xs mt-1.5 pt-1.5 border-t border-neutral-100">
                                <strong>Instructions:</strong> {item.instructions}
                              </p>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-neutral-500 italic py-2">Loading items / no items found in this draft.</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    {viewRx.status === "signed" && (
                      <Button size="sm" className="gap-1.5" onClick={() => void handlePrint(viewRx)}>
                        <Printer className="h-4 w-4" /> Print Rx
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setViewRxId(null)}>
                      Close Detail
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}
      </PatientPageShell>
    </PermissionGate>
  )
}
