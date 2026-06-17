"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Calendar, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createAppointment } from "@/lib/appointments/appointment-service"
import { fetchOrganization } from "@/lib/auth/auth-service"
import { fetchOrgStaff } from "@/lib/staff/staff-service"
import { useAuth } from "@/hooks/use-auth"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import {
  fetchPreparedAppointmentSlots,
  manilaScheduledAtIso,
  pickDefaultSlotTime,
} from "@/lib/appointments/appointment-slots"
import type { AppointmentSlot } from "@/lib/appointments/provider-availability-service"
import { AppointmentSlotButtons } from "@/components/appointments/AppointmentSlotButtons"
import { getPatientBillingGate, type PatientBillingGate } from "@/lib/billing/invoice-service"
import { PatientBillingGateBanner } from "@/components/billing/PatientBillingGateBanner"
import { notify } from "@/lib/ui/notify"

interface BookAppointmentDialogProps {
  patientId: string
  onBooked?: () => void
}

export function BookAppointmentDialog({ patientId, onBooked }: BookAppointmentDialogProps) {
  const { user } = useAuth()
  const { activeBranch } = useBranch()
  const { t } = useLocale()
  const [open, setOpen] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const [date, setDate] = React.useState("")
  const [time, setTime] = React.useState("")
  const [purpose, setPurpose] = React.useState("")
  const [providerId, setProviderId] = React.useState("")
  const [providers, setProviders] = React.useState<Array<{ profile_id: string; full_name?: string | null }>>([])
  const [slots, setSlots] = React.useState<AppointmentSlot[]>([])
  const [slotsLoading, setSlotsLoading] = React.useState(false)
  const [billingGate, setBillingGate] = React.useState<PatientBillingGate | null>(null)
  const [forceBillingOverride, setForceBillingOverride] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

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
    getPatientBillingGate(patientId).then(({ data }) => setBillingGate(data))
    setForceBillingOverride(false)
  }, [open, activeBranch, patientId])

  React.useEffect(() => {
    if (!open || !activeBranch || !providerId || !date) {
      setSlots([])
      return
    }
    setSlotsLoading(true)
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
  }, [open, activeBranch, providerId, date])

  const billingBlocked =
    billingGate?.has_billing_gap === true && !forceBillingOverride

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !activeBranch || !date || !providerId || !time) return
    if (billingBlocked) {
      notify.error(t("billing.gateBlocked", "Resolve billing before booking or use override."))
      return
    }
    setSaving(true)

    const org = await fetchOrganization()
    if (!org) {
      notify.error(t("common.orgNotFound", "Organization not found"))
      setSaving(false)
      return
    }

    const scheduledAt = manilaScheduledAtIso(date, time)
    const { error: createError } = await createAppointment({
      organizationId: org.id,
      branchId: activeBranch.id,
      patientId,
      scheduledAt,
      purpose,
      userId: user.id,
      providerId,
      bookingSource: "staff",
      forceBillingOverride,
    })

    setSaving(false)
    if (createError) {
      notify.error(createError)
      return
    }
    notify.success(t("appointments.bookingSuccess", "Appointment created successfully"))
    setOpen(false)
    setPurpose("")
    setDate("")
    setTime("")
    onBooked?.()
  }

  const dialog = open ? (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label={t("common.close", "Close")}
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-[201] w-full max-w-lg rounded-xl border border-neutral-200 bg-white shadow-xl animate-fade-rise max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
          <h2 className="text-base font-semibold">{t("appointments.bookTitle", "Book appointment")}</h2>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          {billingGate?.has_billing_gap ? (
            <PatientBillingGateBanner gate={billingGate} patientId={patientId} />
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
              <p className="text-xs text-neutral-500">{t("appointments.loadingSlots", "Loading slots…")}</p>
            ) : !date || !providerId ? (
              <p className="text-xs text-neutral-500">{t("appointments.selectDentistAndDate", "Select dentist and date.")}</p>
            ) : (
              <AppointmentSlotButtons
                slots={slots}
                selectedTime={time}
                onSelect={setTime}
                date={date}
                loading={slotsLoading}
                emptyMessage={t("appointments.noSlotsBook", "No open slots — pick another day.")}
              />
            )}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">{t("appointments.purpose", "Purpose")}</label>
            <Input
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder={t("appointments.purposePlaceholder", "Consultation, cleaning…")}
              required
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={saving || !time || billingBlocked}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("appointments.booking", "Booking…")}
                </>
              ) : (
                t("appointments.confirmBooking", "Confirm booking")
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel", "Cancel")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  ) : null

  return (
    <>
      <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <Calendar className="h-4 w-4" /> {t("appointments.bookNow", "Book now")}
      </Button>
      {mounted && dialog ? createPortal(dialog, document.body) : null}
    </>
  )
}
