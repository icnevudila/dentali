"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useBranch } from "@/hooks/use-branch"
import { useAuth } from "@/hooks/use-auth"
import { useLocale } from "@/hooks/use-locale"
import { fetchOrganization } from "@/lib/auth/auth-service"
import { searchPatients } from "@/lib/patients/patient-service"
import { fetchPatientInsuranceProfiles } from "@/lib/patients/insurance-service"
import { createPhilHealthClaim } from "@/lib/billing/philhealth-service"

interface PhilHealthClaimDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

export function PhilHealthClaimDrawer({
  open,
  onOpenChange,
  onCreated,
}: PhilHealthClaimDrawerProps) {
  const { activeBranch } = useBranch()
  const { user } = useAuth()
  const { t } = useLocale()

  const [patientQuery, setPatientQuery] = React.useState("")
  const [patients, setPatients] = React.useState<
    Awaited<ReturnType<typeof searchPatients>>["data"]
  >([])
  const [selectedPatientId, setSelectedPatientId] = React.useState("")
  const [selectedPatientName, setSelectedPatientName] = React.useState("")
  const [philhealthId, setPhilhealthId] = React.useState("")
  const [caseRate, setCaseRate] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const resetForm = React.useCallback(() => {
    setPatientQuery("")
    setPatients([])
    setSelectedPatientId("")
    setSelectedPatientName("")
    setPhilhealthId("")
    setCaseRate("")
    setSaving(false)
    setError(null)
  }, [])

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

  // Patient search debounce
  React.useEffect(() => {
    if (!activeBranch || patientQuery.length < 2) {
      setPatients([])
      return
    }
    const timer = setTimeout(
      () => searchPatients(patientQuery, activeBranch.id).then(({ data }) => setPatients(data)),
      300
    )
    return () => clearTimeout(timer)
  }, [patientQuery, activeBranch])

  const pickPatient = async (patientId: string, displayName: string) => {
    setSelectedPatientId(patientId)
    setSelectedPatientName(displayName)
    setPatientQuery(displayName)
    setPatients([])
    const { data: profiles } = await fetchPatientInsuranceProfiles(patientId)
    const ph = profiles.find((p) => p.payer_type === "philhealth" && p.member_id)
    if (ph?.member_id) setPhilhealthId(ph.member_id)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !activeBranch || !selectedPatientId) return
    setSaving(true)
    setError(null)
    const org = await fetchOrganization()
    if (!org) {
      setError("Organization not found")
      setSaving(false)
      return
    }
    const { error: err } = await createPhilHealthClaim({
      organizationId: org.id,
      branchId: activeBranch.id,
      patientId: selectedPatientId,
      philhealthId,
      caseRateCode: caseRate,
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
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l bg-white shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">
              {t("billing.newPhilHealthClaim", "New PhilHealth claim")}
            </h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              {t("billing.philHealthDrawerHint", "Select a patient and prepare their PhilHealth claim parameters.")}
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
          <form id="philhealth-claim-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Patient search */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600">
                {t("billing.patient", "Patient")} *
              </label>
              <div className="relative">
                <Input
                  placeholder={t("billing.searchPatient", "Search patient…")}
                  value={patientQuery}
                  onChange={(e) => {
                    setPatientQuery(e.target.value)
                    if (selectedPatientId) {
                      setSelectedPatientId("")
                      setSelectedPatientName("")
                    }
                  }}
                  autoComplete="off"
                />
                {patients.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-lg max-h-40 overflow-y-auto">
                    {patients.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 transition-colors"
                          onClick={() => void pickPatient(p.id, `${p.first_name} ${p.last_name}`)}
                        >
                          {p.first_name} {p.last_name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {selectedPatientName && (
                <p className="text-xs text-green-700 font-medium">✓ {selectedPatientName}</p>
              )}
            </div>

            {/* PhilHealth ID */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600">
                {t("billing.philHealthId", "PhilHealth PIN")} *
              </label>
              <Input
                placeholder="00-000000000-0"
                required
                value={philhealthId}
                onChange={(e) => setPhilhealthId(e.target.value)}
              />
            </div>

            {/* Case Rate Code */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600">
                {t("billing.caseRateCode", "Case rate code")}
              </label>
              <Input
                placeholder="e.g. 90185"
                value={caseRate}
                onChange={(e) => setCaseRate(e.target.value)}
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
              form="philhealth-claim-form"
              disabled={saving || !selectedPatientId}
              className="flex-1"
            >
              {saving
                ? t("common.saving", "Saving…")
                : t("billing.prepareClaim", "Prepare claim")}
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
