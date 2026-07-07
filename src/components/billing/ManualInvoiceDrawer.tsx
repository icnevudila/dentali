"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { X } from "lucide-react"
import { useBranch } from "@/hooks/use-branch"
import { useAuth } from "@/hooks/use-auth"
import { useLocale } from "@/hooks/use-locale"
import { fetchOrganization } from "@/lib/auth/auth-service"
import { searchPatients } from "@/lib/patients/patient-service"
import { createManualInvoice } from "@/lib/billing/invoice-service"
import { notify } from "@/lib/ui/notify"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function ManualInvoiceDrawer({
  open,
  onOpenChange,
  defaultPatientId,
  defaultPatientLabel,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultPatientId?: string
  defaultPatientLabel?: string
  onCreated?: (invoiceId: string) => void
}) {
  const router = useRouter()
  const { activeBranch } = useBranch()
  const { user } = useAuth()
  const { t } = useLocale()

  const [patientSearch, setPatientSearch] = React.useState("")
  const [selectedPatientId, setSelectedPatientId] = React.useState("")
  const [patientResults, setPatientResults] = React.useState<
    Awaited<ReturnType<typeof searchPatients>>["data"]
  >([])
  const [amount, setAmount] = React.useState("")
  const [hmoShare, setHmoShare] = React.useState("")
  const [philHealthShare, setPhilHealthShare] = React.useState("")
  const [dueDate, setDueDate] = React.useState("")
  const [customInvoiceNumber, setCustomInvoiceNumber] = React.useState("")
  const [series, setSeries] = React.useState("INV")
  const [creating, setCreating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setError(null)
    if (defaultPatientId) {
      setSelectedPatientId(defaultPatientId)
      setPatientSearch(defaultPatientLabel ?? "")
    } else {
      setSelectedPatientId("")
      setPatientSearch("")
    }
    setAmount("")
    setHmoShare("")
    setPhilHealthShare("")
    setDueDate("")
    setCustomInvoiceNumber("")
    setSeries("INV")
    setPatientResults([])
  }, [open, defaultPatientId, defaultPatientLabel])

  React.useEffect(() => {
    if (!open || !activeBranch || patientSearch.trim().length < 2 || selectedPatientId) {
      setPatientResults([])
      return
    }
    const timer = setTimeout(() => {
      searchPatients(patientSearch.trim(), activeBranch.id).then(({ data }) => setPatientResults(data))
    }, 300)
    return () => clearTimeout(timer)
  }, [patientSearch, activeBranch, open])

  const close = () => onOpenChange(false)

  const handlePatientSearchChange = (value: string) => {
    setPatientSearch(value)
    if (selectedPatientId && value.trim() !== defaultPatientLabel?.trim()) {
      setSelectedPatientId("")
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !activeBranch || !selectedPatientId) return
    const totalAmount = parseFloat(amount)
    if (!totalAmount || totalAmount <= 0) return

    let finalInvoiceNumber = customInvoiceNumber.trim()
    if (!finalInvoiceNumber) {
      const generated = `${series}-${Date.now().toString(36).toUpperCase()}`
      const confirmed = await notify.confirm(
        `No invoice number entered. Auto-generate as "${generated}"?`
      )
      if (!confirmed) return
      finalInvoiceNumber = generated
    }

    setCreating(true)
    setError(null)
    const org = await fetchOrganization()
    if (!org) {
      setError("Organization not found")
      setCreating(false)
      return
    }

    const { data, error: err } = await createManualInvoice({
      organizationId: org.id,
      branchId: activeBranch.id,
      patientId: selectedPatientId,
      totalAmount,
      dueDate: dueDate || undefined,
      userId: user.id,
      series,
      invoiceNumber: finalInvoiceNumber,
    })

    setCreating(false)
    if (err) {
      notify.error(err)
      setError(err)
      return
    }

    notify.success("Invoice created successfully")
    close()
    if (data?.id) {
      onCreated?.(data.id)
      router.push(`/billing/${data.id}`)
    }
  }

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div className="fixed inset-0 z-[250] flex justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-label={t("common.close", "Close")}
        onClick={close}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-invoice-title"
        className="relative z-[251] flex h-full w-full max-w-md flex-col border-l border-neutral-200 bg-white p-6 shadow-2xl animate-slide-left"
      >
        <div className="mb-6 flex items-center justify-between border-b pb-4">
          <h2 id="manual-invoice-title" className="text-lg font-bold text-neutral-950">
            {t("billing.createInvoiceTitle", "Create manual invoice")}
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

          <div className="relative space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              {t("billing.searchPatient", "Search patient")}
            </label>
            <Input
              placeholder={t("appointments.searchPatientPlaceholder", "Name or phone…")}
              value={patientSearch}
              onChange={(e) => handlePatientSearchChange(e.target.value)}
              disabled={Boolean(defaultPatientId)}
              autoComplete="off"
            />
            {defaultPatientId ? (
              <p className="text-[10px] text-neutral-400">Patient locked to current chart.</p>
            ) : null}
            {patientResults.length > 0 && !defaultPatientId ? (
              <ul className="absolute left-0 right-0 z-20 mt-1 max-h-48 divide-y overflow-y-auto rounded-md border border-neutral-200 bg-white shadow-lg">
                {patientResults.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-50"
                      onClick={() => {
                        setSelectedPatientId(p.id)
                        setPatientSearch(`${p.first_name} ${p.last_name}`)
                        setPatientResults([])
                      }}
                    >
                      {p.first_name} {p.last_name}
                      {p.phone ? <span className="text-neutral-400"> · {p.phone}</span> : null}
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

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Invoice series
            </label>
            <select
              className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none"
              value={series}
              onChange={(e) => setSeries(e.target.value)}
            >
              <option value="INV">INV (Default)</option>
              <option value="A">Series A</option>
              <option value="B">Series B</option>
              <option value="C">Series C</option>
              <option value="REC">REC (Receipt)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Invoice number (optional)
            </label>
            <Input
              placeholder="e.g. INV-00201"
              value={customInvoiceNumber}
              onChange={(e) => setCustomInvoiceNumber(e.target.value)}
            />
            <p className="text-[10px] text-neutral-400">
              {t("billing.invoiceNumberAutoHint", "Leave blank to auto-generate based on series.")}
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              {t("billing.invoiceAmountLabel", "Invoice amount (PHP)")}
            </label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              placeholder={t("billing.invoiceAmount", "Amount (PHP)")}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          {/* DYNAMIC PAY-SHARE ALLOCATION CALCULATOR */}
          {parseFloat(amount) > 0 && (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 space-y-4 animate-fade-rise">
              <div className="text-xs font-bold text-neutral-600 uppercase tracking-wide">
                HMO &amp; PhilHealth Pay-Share Breakdown
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-neutral-500 uppercase">HMO Coverage (₱)</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="₱0.00"
                    value={hmoShare}
                    onChange={(e) => setHmoShare(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-neutral-500 uppercase">PhilHealth (₱)</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="₱0.00"
                    value={philHealthShare}
                    onChange={(e) => setPhilHealthShare(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Dynamic Stacked Bar */}
              {(() => {
                const total = parseFloat(amount) || 0
                const hmo = parseFloat(hmoShare) || 0
                const ph = parseFloat(philHealthShare) || 0
                const patient = Math.max(0, total - hmo - ph)
                
                const hmoPct = total > 0 ? (hmo / total) * 100 : 0
                const phPct = total > 0 ? (ph / total) * 100 : 0
                const patientPct = total > 0 ? (patient / total) * 100 : 100

                return (
                  <div className="space-y-2">
                    <div className="flex h-3 w-full overflow-hidden rounded-full bg-neutral-200 shadow-inner">
                      {hmoPct > 0 && (
                        <div
                          className="bg-teal-500 transition-all duration-300"
                          style={{ width: `${hmoPct}%` }}
                          title={`HMO: ₱${hmo.toLocaleString()}`}
                        />
                      )}
                      {phPct > 0 && (
                        <div
                          className="bg-amber-500 transition-all duration-300"
                          style={{ width: `${phPct}%` }}
                          title={`PhilHealth: ₱${ph.toLocaleString()}`}
                        />
                      )}
                      {patientPct > 0 && (
                        <div
                          className="bg-primary-500 transition-all duration-300"
                          style={{ width: `${patientPct}%` }}
                          title={`Patient: ₱${patient.toLocaleString()}`}
                        />
                      )}
                    </div>
                    
                    <div className="flex flex-wrap justify-between text-[10px] text-neutral-500 font-medium">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-primary-500" />
                        Patient: ₱{patient.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      {hmo > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-teal-500" />
                          HMO: ₱{hmo.toLocaleString()}
                        </span>
                      )}
                      {ph > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          PhilHealth: ₱{ph.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              {t("billing.dueDateLabel", "Due date")}
            </label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              aria-label={t("billing.dueDate", "Due date")}
            />
          </div>

          <div className="mt-auto flex gap-2 border-t pt-4">
            <Button type="submit" className="w-full" disabled={creating || !selectedPatientId}>
              {creating ? t("billing.creating", "Creating…") : t("billing.createInvoice", "New invoice")}
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={close}>
              {t("common.cancel", "Cancel")}
            </Button>
          </div>
        </form>
      </aside>
    </div>,
    document.body
  )
}
