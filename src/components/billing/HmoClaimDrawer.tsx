"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { useBranch } from "@/hooks/use-branch"
import { useAuth } from "@/hooks/use-auth"
import { fetchOrganization } from "@/lib/auth/auth-service"
import { searchPatients } from "@/lib/patients/patient-service"
import { fetchPatientInsuranceProfiles } from "@/lib/patients/insurance-service"
import { createHmoClaim } from "@/lib/billing/hmo-service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function HmoClaimDrawer({
  open,
  onOpenChange,
  providers,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  providers: { id: string; name: string }[]
  onCreated: () => void
}) {
  const { activeBranch } = useBranch()
  const { user } = useAuth()

  const [patientSearch, setPatientSearch] = React.useState("")
  const [selectedPatientId, setSelectedPatientId] = React.useState("")
  const [patientResults, setPatientResults] = React.useState<
    Awaited<ReturnType<typeof searchPatients>>["data"]
  >([])
  const [providerId, setProviderId] = React.useState("")
  const [memberId, setMemberId] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Reset form when drawer opens
  React.useEffect(() => {
    if (!open) return
    setError(null)
    setPatientSearch("")
    setSelectedPatientId("")
    setPatientResults([])
    setProviderId("")
    setMemberId("")
    setAmount("")
  }, [open])

  // Patient autocomplete
  React.useEffect(() => {
    if (!open || !activeBranch || patientSearch.trim().length < 2 || selectedPatientId) {
      setPatientResults([])
      return
    }
    const timer = setTimeout(() => {
      searchPatients(patientSearch.trim(), activeBranch.id).then(({ data }) =>
        setPatientResults(data)
      )
    }, 300)
    return () => clearTimeout(timer)
  }, [patientSearch, activeBranch, open, selectedPatientId])

  const close = () => onOpenChange(false)

  const handlePatientSearchChange = (value: string) => {
    setPatientSearch(value)
    if (selectedPatientId) {
      setSelectedPatientId("")
    }
  }

  const pickPatient = async (patientId: string, displayName: string) => {
    setSelectedPatientId(patientId)
    setPatientSearch(displayName)
    setPatientResults([])
    const { data: profiles } = await fetchPatientInsuranceProfiles(patientId)
    const hmo = profiles.find((p) => p.payer_type === "hmo")
    if (hmo?.member_id) setMemberId(hmo.member_id)
    if (hmo?.payer_name && providers.length > 0) {
      const match = providers.find(
        (p) => p.name.toLowerCase() === hmo.payer_name!.toLowerCase()
      )
      if (match) setProviderId(match.id)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !activeBranch || !selectedPatientId || !providerId) return
    setSaving(true)
    setError(null)
    const org = await fetchOrganization()
    if (!org) {
      setError("Organization not found")
      setSaving(false)
      return
    }
    const { error: err } = await createHmoClaim({
      organizationId: org.id,
      branchId: activeBranch.id,
      patientId: selectedPatientId,
      providerId,
      memberId: memberId || undefined,
      claimedAmount: parseFloat(amount) || 0,
      userId: user.id,
    })
    setSaving(false)
    if (err) {
      setError(err)
      return
    }
    onCreated()
    close()
  }

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div className="fixed inset-0 z-[250] flex justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={close}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="hmo-claim-drawer-title"
        className="relative z-[251] flex h-full w-full max-w-md flex-col border-l border-neutral-200 bg-white p-6 shadow-2xl animate-slide-left"
      >
        <div className="mb-6 flex items-center justify-between border-b pb-4">
          <h2 id="hmo-claim-drawer-title" className="text-lg font-bold text-neutral-950">
            Draft HMO claim
          </h2>
          <Button variant="ghost" size="icon" type="button" onClick={close}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={handleCreate} className="flex flex-1 flex-col gap-4 overflow-y-auto">
          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          {/* Patient search */}
          <div className="relative space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Search patient
            </label>
            <Input
              placeholder="Name or phone…"
              value={patientSearch}
              onChange={(e) => handlePatientSearchChange(e.target.value)}
              autoComplete="off"
            />
            {patientResults.length > 0 ? (
              <ul className="absolute left-0 right-0 z-20 mt-1 max-h-48 divide-y overflow-y-auto rounded-md border border-neutral-200 bg-white shadow-lg">
                {patientResults.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-50"
                      onClick={() => void pickPatient(p.id, `${p.first_name} ${p.last_name}`)}
                    >
                      {p.first_name} {p.last_name}
                      {p.phone ? (
                        <span className="text-neutral-400"> · {p.phone}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {selectedPatientId ? (
              <p className="text-xs text-emerald-700">Patient selected.</p>
            ) : patientSearch.length >= 2 ? (
              <p className="text-xs text-neutral-400">Pick a patient from the list.</p>
            ) : null}
          </div>

          {/* HMO provider */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              HMO provider
            </label>
            <select
              className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none"
              required
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
            >
              <option value="">Select HMO provider</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Member ID */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Member ID
            </label>
            <Input
              placeholder="Auto-filled from patient profile"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
            />
          </div>

          {/* Claimed amount */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Claimed amount (PHP)
            </label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Amount (PHP)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="mt-auto flex gap-2 border-t pt-4">
            <Button
              type="submit"
              className="w-full"
              disabled={saving || !selectedPatientId || !providerId}
            >
              {saving ? "Saving…" : "Create draft"}
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={close}>
              Cancel
            </Button>
          </div>
        </form>
      </aside>
    </div>,
    document.body
  )
}
