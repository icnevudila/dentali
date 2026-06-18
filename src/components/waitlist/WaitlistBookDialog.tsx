"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/use-auth"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { fetchOrgStaff } from "@/lib/staff/staff-service"
import {
  fetchPreparedAppointmentSlots,
  manilaScheduledAtIso,
  pickDefaultSlotTime,
} from "@/lib/appointments/appointment-slots"
import type { AppointmentSlot } from "@/lib/appointments/provider-availability-service"
import { AppointmentSlotButtons } from "@/components/appointments/AppointmentSlotButtons"
import { getPatientBillingGate, type PatientBillingGate } from "@/lib/billing/invoice-service"
import { PatientBillingGateBanner } from "@/components/billing/PatientBillingGateBanner"
import { bookFromWaitlist, type WaitlistEntry } from "@/lib/waitlist/waitlist-service"
import { notify } from "@/lib/ui/notify"

interface WaitlistBookDialogProps {
  entry: WaitlistEntry | null
  onClose: () => void
  onBooked?: () => void
  actionLoading: string | null
  onActionLoading: (id: string | null) => void
}

export function WaitlistBookDialog({
  entry,
  onClose,
  onBooked,
  actionLoading,
  onActionLoading,
}: WaitlistBookDialogProps) {
  const { user } = useAuth()
  const { activeBranch } = useBranch()
  const { t } = useLocale()
  const [date, setDate] = React.useState("")
  const [time, setTime] = React.useState("")
  const [purpose, setPurpose] = React.useState("")
  const [providerId, setProviderId] = React.useState("")
  const [providers, setProviders] = React.useState<Array<{ profile_id: string; full_name?: string | null }>>([])
  const [slots, setSlots] = React.useState<AppointmentSlot[]>([])
  const [slotsLoading, setSlotsLoading] = React.useState(false)
  const [billingGate, setBillingGate] = React.useState<PatientBillingGate | null>(null)
  const [forceBillingOverride, setForceBillingOverride] = React.useState(false)

  const open = entry !== null

  React.useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  React.useEffect(() => {
    if (!entry) return
    const id = window.setTimeout(() => {
      setDate(entry.preferred_date ?? "")
      setTime(entry.preferred_time_start?.slice(0, 5) ?? "")
      setPurpose(entry.notes ?? "")
    }, 0)
    return () => window.clearTimeout(id)
  }, [entry])

  React.useEffect(() => {
    if (!open || !activeBranch) return
    fetchOrgStaff().then(({ data }) => {
      const branchProviders = data.filter(
        (s) => s.is_active && s.branch_names.includes(activeBranch.name)
      )
      setProviders(branchProviders)
      if (branchProviders.length > 0) {
        setProviderId((prev) => prev || branchProviders[0].profile_id)
      }
    })
    if (entry?.patient_id) {
      getPatientBillingGate(entry.patient_id).then(({ data }) => setBillingGate(data))
    }
    const id = window.setTimeout(() => setForceBillingOverride(false), 0)
    return () => window.clearTimeout(id)
  }, [open, activeBranch, entry?.patient_id])

  React.useEffect(() => {
    if (!open || !activeBranch || !providerId || !date) {
      const id = window.setTimeout(() => setSlots([]), 0)
      return () => window.clearTimeout(id)
    }
    const loadingId = window.setTimeout(() => setSlotsLoading(true), 0)
    void fetchPreparedAppointmentSlots({
      branchId: activeBranch.id,
      providerId,
      date,
    }).then(({ data, error: slotError }) => {
      setSlots(data)
      setSlotsLoading(false)
      if (slotError) notify.error(slotError)
      setTime((prev) => pickDefaultSlotTime(data, prev, undefined, date))
    })
    return () => window.clearTimeout(loadingId)
  }, [open, activeBranch, providerId, date])

  const billingBlocked = billingGate?.has_billing_gap === true && !forceBillingOverride
  const saving = entry ? actionLoading === entry.id : false

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !activeBranch || !entry || !date || !providerId || !time) return
    if (billingBlocked) {
      notify.error(t("billing.gateBlocked", "Resolve billing before booking or use override."))
      return
    }

    onActionLoading(entry.id)

    const scheduledAt = manilaScheduledAtIso(date, time)
    const { error: bookError } = await bookFromWaitlist(
      entry.id,
      scheduledAt,
      purpose || entry.notes || undefined,
      providerId,
      forceBillingOverride
    )

    onActionLoading(null)

    if (bookError) {
      notify.error(bookError)
      return
    }

    notify.success(t("waitlist.booked", "Appointment booked from waitlist"))
    onClose()
    onBooked?.()
  }

  const dialog = open && entry ? (
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label={t("common.close", "Close")}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-[201] flex max-h-[min(92vh,100dvh)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-neutral-200 bg-white shadow-xl animate-fade-rise sm:max-h-[90vh] sm:rounded-xl"
      >
        <div className="shrink-0 border-b border-neutral-100 px-4 pb-4 pt-3 sm:pt-4">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-neutral-200 sm:hidden" />
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">
              {t("waitlist.bookTitle", "Book appointment")} - {entry.patient_name}
            </h2>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto p-4 pb-6">
            {billingGate?.has_billing_gap ? (
              <PatientBillingGateBanner gate={billingGate} patientId={entry.patient_id} />
            ) : null}
            {billingGate?.has_billing_gap ? (
              <label className="flex items-start gap-2 text-xs text-amber-900">
                <input
                  type="checkbox"
                  checked={forceBillingOverride}
                  onChange={(e) => setForceBillingOverride(e.target.checked)}
                  className="mt-0.5"
                />
                {t(
                  "billing.gateOverrideBook",
                  "Override billing block for this booking (logged in audit)"
                )}
              </label>
            ) : null}
            <div className="space-y-1">
              <label className="text-xs font-medium">{t("appointments.provider", "Provider")}</label>
              <select
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                className="h-10 w-full rounded-md border border-neutral-300 px-3 text-sm"
                required
              >
                {providers.map((p) => (
                  <option key={p.profile_id} value={p.profile_id}>
                    {p.full_name ?? p.profile_id}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t("appointments.date", "Date")}</label>
              <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">{t("appointments.availableSlots", "Available Slots")}</label>
              {slotsLoading ? (
                <p className="text-xs text-neutral-500">{t("appointments.loadingSlots", "Loading slots...")}</p>
              ) : !date || !providerId ? (
                <p className="text-xs text-neutral-500">
                  {t("appointments.selectDentistAndDate", "Select dentist and date.")}
                </p>
              ) : (
                <AppointmentSlotButtons
                  slots={slots}
                  selectedTime={time}
                  onSelect={setTime}
                  date={date}
                  loading={slotsLoading}
                  emptyMessage={t("appointments.noSlotsBook", "No open slots - pick another day.")}
                />
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t("appointments.purpose", "Purpose")}</label>
              <Input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder={t("appointments.purposePlaceholder", "Consultation, cleaning...")}
              />
            </div>
          </div>
          <div className="shrink-0 border-t border-neutral-100 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="w-full sm:w-auto" type="submit" disabled={saving || !time || billingBlocked}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("appointments.booking", "Booking...")}
                  </>
                ) : (
                  t("waitlist.createAppointment", "Create appointment")
                )}
              </Button>
              <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={onClose}>
                {t("common.cancel", "Cancel")}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  ) : null

  return typeof document !== "undefined" && dialog ? createPortal(dialog, document.body) : null
}
