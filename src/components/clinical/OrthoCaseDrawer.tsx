"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/use-auth"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { fetchOrganization } from "@/lib/auth/auth-service"
import { createOrthoCase, updateOrthoCase, type OrthoCase } from "@/lib/clinical/ortho-service"

interface OrthoCaseDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientId: string
  onCreated: () => void
  initialCase?: OrthoCase | null
}

const APPLIANCE_PRESETS = [
  "Metal braces",
  "Ceramic braces",
  "Self-ligating braces",
  "Clear aligners",
  "Lingual braces",
  "Retainer / Maintenance",
]

const DIAGNOSIS_PRESETS = [
  "Class I Malocclusion",
  "Class II Division 1 Malocclusion",
  "Class II Division 2 Malocclusion",
  "Class III Malocclusion",
  "Crowding",
  "Spacing",
  "Open bite",
  "Deep bite",
  "Crossbite",
]

export function OrthoCaseDrawer({
  open,
  onOpenChange,
  patientId,
  onCreated,
  initialCase,
}: OrthoCaseDrawerProps) {
  const { activeBranch } = useBranch()
  const { user } = useAuth()
  const { t } = useLocale()

  const [applianceType, setApplianceType] = React.useState(APPLIANCE_PRESETS[0])
  const [startDate, setStartDate] = React.useState("")
  const [contractAmount, setContractAmount] = React.useState("")
  const [caseNotes, setCaseNotes] = React.useState("")
  const [diagnosis, setDiagnosis] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const resetForm = React.useCallback(() => {
    setApplianceType(APPLIANCE_PRESETS[0])
    setStartDate("")
    setContractAmount("")
    setCaseNotes("")
    setDiagnosis("")
    setSaving(false)
    setError(null)
  }, [])

  // Sync state with initialCase when drawer opens or initialCase changes
  React.useEffect(() => {
    if (open) {
      if (initialCase) {
        setApplianceType(initialCase.appliance_type ?? APPLIANCE_PRESETS[0])
        setStartDate(initialCase.start_date ?? "")
        setContractAmount(String(initialCase.contract_amount))
        setCaseNotes(initialCase.notes ?? "")
        setDiagnosis(initialCase.diagnosis ?? "")
      } else {
        resetForm()
      }
    }
  }, [initialCase, open, resetForm])

  // Close on Escape
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onOpenChange])

  // Reset form when drawer closes
  React.useEffect(() => {
    if (!open) resetForm()
  }, [open, resetForm])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !activeBranch) return
    setSaving(true)
    setError(null)

    if (initialCase) {
      const { error: err } = await updateOrthoCase({
        caseId: initialCase.id,
        applianceType,
        startDate: startDate || new Date().toISOString().slice(0, 10),
        contractAmount: parseFloat(contractAmount) || 0,
        notes: caseNotes || undefined,
        diagnosis: diagnosis || undefined,
      })
      setSaving(false)
      if (err) {
        setError(err)
      } else {
        onOpenChange(false)
        onCreated()
      }
    } else {
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
        startDate: startDate || new Date().toISOString().slice(0, 10),
        contractAmount: parseFloat(contractAmount) || 0,
        notes: caseNotes || undefined,
        diagnosis: diagnosis || undefined,
        userId: user.id,
      })

      setSaving(false)
      if (err) {
        setError(err)
      } else {
        onOpenChange(false)
        onCreated()
      }
    }
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[250] flex justify-end">
      {/* Backdrop */}
      <button
        type="button"
        aria-label={t("common.close", "Close")}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Drawer panel */}
      <aside className="relative z-10 flex h-full w-full max-w-lg flex-col border-l bg-white shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">
              {initialCase
                ? t("ortho.editCase", "Edit Ortho Case")
                : t("ortho.newCase", "New Ortho Case")}
            </h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              {initialCase
                ? t("ortho.editCaseHint", "Modify orthodontic record parameters and diagnosis.")
                : t("ortho.newCaseHint", "Start a new orthodontic record and define the treatment plan contract.")}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <form id="ortho-case-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Appliance Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600">
                {t("ortho.applianceType", "Appliance type")} *
              </label>
              <select
                className="h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
                value={applianceType}
                onChange={(e) => setApplianceType(e.target.value)}
              >
                {APPLIANCE_PRESETS.map((app) => (
                  <option key={app} value={app}>
                    {app}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600">
                {t("ortho.startDate", "Start date")} *
              </label>
              <Input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {/* Contract Amount */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600">
                {t("ortho.contractAmount", "Contract amount (₱)")} *
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                required
                value={contractAmount}
                onChange={(e) => setContractAmount(e.target.value)}
              />
            </div>

            {/* Diagnosis */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600">
                {t("ortho.diagnosis", "Diagnosis")}
              </label>
              <select
                className="h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500 mb-2"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
              >
                <option value="">{t("ortho.selectDiagnosis", "Select diagnosis preset…")}</option>
                {DIAGNOSIS_PRESETS.map((diag) => (
                  <option key={diag} value={diag}>
                    {diag}
                  </option>
                ))}
              </select>
              <Input
                placeholder={t("ortho.customDiagnosis", "Or enter custom diagnosis details…")}
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
              />
            </div>

            {/* Case Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600">
                {t("ortho.caseNotes", "Case notes")}
              </label>
              <textarea
                className="w-full min-h-[80px] rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder={t("ortho.caseNotesPlaceholder", "Appliance specifications, elastic configuration, etc.")}
                value={caseNotes}
                onChange={(e) => setCaseNotes(e.target.value)}
              />
            </div>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="border-t bg-neutral-50/60 px-6 py-4">
          <div className="flex gap-3">
            <Button
              type="submit"
              form="ortho-case-form"
              disabled={saving}
              className="flex-1"
            >
              {saving
                ? t("common.saving", "Saving…")
                : initialCase
                ? t("ortho.saveCase", "Save changes")
                : t("ortho.startCase", "Start case")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel", "Cancel")}
            </Button>
          </div>
        </div>
      </aside>
    </div>,
    document.body
  )
}
