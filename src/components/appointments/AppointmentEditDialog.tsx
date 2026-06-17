"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { useLocale } from "@/hooks/use-locale"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, X } from "lucide-react"
import { notify } from "@/lib/ui/notify"
import {
  rescheduleAppointment,
  updateAppointmentDetails,
  type AppointmentRecord,
} from "@/lib/appointments/appointment-service"
import {
  ensureProviderAvailabilityDefaults,
  type AppointmentSlot,
} from "@/lib/appointments/provider-availability-service"
import {
  fetchPreparedAppointmentSlots,
  manilaScheduledAtIso,
  pickDefaultSlotTime,
} from "@/lib/appointments/appointment-slots"
import { appointmentDateKey } from "@/lib/appointments/week-calendar"
import { AppointmentSlotButtons } from "@/components/appointments/AppointmentSlotButtons"

type ProviderOption = { profile_id: string; full_name?: string | null; email?: string | null }

export function AppointmentEditDialog({
  open,
  onOpenChange,
  appointment,
  providers,
  branchId,
  onSaved,
  onFreedSlot,
}: {
  open: boolean
  onOpenChange: (isOpen: boolean) => void
  appointment: AppointmentRecord | null
  providers: ProviderOption[]
  branchId: string
  onSaved: (updated: AppointmentRecord) => void
  onFreedSlot?: (freedAt: string) => void
}) {
  const { t } = useLocale()
  const [mounted, setMounted] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [providerId, setProviderId] = React.useState("")
  const [purpose, setPurpose] = React.useState("")
  const [selectedPurposeOption, setSelectedPurposeOption] = React.useState("General Checkup")
  const [customPurpose, setCustomPurpose] = React.useState("")
  const [date, setDate] = React.useState("")
  const [time, setTime] = React.useState("")
  const [slots, setSlots] = React.useState<AppointmentSlot[]>([])
  const [slotsLoading, setSlotsLoading] = React.useState(false)
  const [configuringSlots, setConfiguringSlots] = React.useState(false)

  const PRESET_PURPOSES = React.useMemo(
    () => [
      "General Checkup",
      "Dental Cleaning",
      "Tooth Filling",
      "Root Canal",
      "Tooth Extraction",
      "Orthodontic Consultation",
      "Other",
    ],
    []
  )

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

  const extract24HourTime = React.useCallback((iso: string): string => {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso))
  }, [])

  const originalDate = appointment ? appointmentDateKey(appointment.scheduled_at) : ""
  const originalTime = appointment ? extract24HourTime(appointment.scheduled_at) : ""

  React.useEffect(() => {
    if (!open || !appointment) return

    const nextProviderId =
      appointment.provider_id && providers.some((p) => p.profile_id === appointment.provider_id)
        ? appointment.provider_id
        : providers[0]?.profile_id ?? ""

    const origPurpose = appointment.purpose || ""
    setProviderId(nextProviderId)
    setPurpose(origPurpose)
    if (PRESET_PURPOSES.includes(origPurpose)) {
      setSelectedPurposeOption(origPurpose)
      setCustomPurpose("")
    } else if (origPurpose) {
      setSelectedPurposeOption("Other")
      setCustomPurpose(origPurpose)
    } else {
      setSelectedPurposeOption("General Checkup")
      setCustomPurpose("")
    }
    setDate(appointmentDateKey(appointment.scheduled_at))
    setTime(extract24HourTime(appointment.scheduled_at))
  }, [open, appointment, providers, extract24HourTime, PRESET_PURPOSES])

  const loadSlots = React.useCallback(async () => {
    if (!open || !branchId || !providerId || !date || !appointment) {
      setSlots([])
      return
    }

    setSlotsLoading(true)

    const { data, error } = await fetchPreparedAppointmentSlots({
      branchId,
      providerId,
      date,
      excludeAppointmentId: appointment.id,
    })

    setSlots(data)
    setSlotsLoading(false)
    if (error) notify.error(error)

    const preferred =
      originalDate === date ? originalTime : undefined
    setTime((prev) =>
      pickDefaultSlotTime(
        data,
        preferred ?? prev,
        originalDate === date ? originalTime : undefined,
        date
      )
    )
  }, [open, branchId, providerId, date, appointment, originalDate, originalTime])

  React.useEffect(() => {
    void loadSlots()
  }, [loadSlots])

  const handleConfigureSlots = async () => {
    if (!branchId || !providerId) return
    setConfiguringSlots(true)
    const { error } = await ensureProviderAvailabilityDefaults(branchId, providerId)
    if (error) {
      notify.error(error)
      setConfiguringSlots(false)
      return
    }
    await loadSlots()
    setConfiguringSlots(false)
    notify.success(t("appointments.slotsConfigured", "Working hours configured for this dentist."))
  }

  if (!open || !mounted || !appointment) return null

  const selectedSlot = slots.find((slot) => slot.time === time)
  const canPickTime =
    Boolean(time) &&
    Boolean(selectedSlot?.available || (date === originalDate && time === originalTime))
  const scheduleUnchanged = date === originalDate && time === originalTime

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!providerId) {
      notify.error(t("appointments.selectDentistAndDate", "Select dentist and date."))
      return
    }
    if (!canPickTime && !scheduleUnchanged) {
      notify.error(t("appointments.pickOpenSlot", "Pick an open slot for the appointment."))
      return
    }

    setSaving(true)

    const finalPurpose = selectedPurposeOption === "Other" ? customPurpose.trim() : selectedPurposeOption
    if (!finalPurpose) {
      notify.error("Please specify a purpose for the appointment")
      setSaving(false)
      return
    }

    const { error: err1 } = await updateAppointmentDetails(appointment.id, {
      providerId: providerId || null,
      purpose: finalPurpose,
    })

    if (err1) {
      notify.error(err1)
      setSaving(false)
      return
    }

    let scheduledAt = appointment.scheduled_at
    if (date !== originalDate || time !== originalTime) {
      scheduledAt = manilaScheduledAtIso(date, time)
      const { error: err2 } = await rescheduleAppointment(appointment.id, scheduledAt)
      if (err2) {
        notify.error(err2)
        setSaving(false)
        return
      }
      onFreedSlot?.(appointment.scheduled_at)
    }

    notify.success(t("appointments.updateSuccess", "Appointment updated successfully"))
    onSaved({
      ...appointment,
      provider_id: providerId || null,
      purpose: finalPurpose,
      scheduled_at: scheduledAt,
    })
    onOpenChange(false)
    setSaving(false)
  }

  const modal = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-appointment-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-6 py-4">
          <div>
            <h2 id="edit-appointment-title" className="text-lg font-semibold text-neutral-900">
              {t("appointments.editAppointment", "Edit / Reschedule Appointment")}
            </h2>
            <p className="text-sm text-neutral-500 mt-0.5">{appointment.patient_name}</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100"
            aria-label={t("common.close", "Close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-4 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium">{t("appointments.provider", "Provider")}</label>
            <select
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              required
              className="flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {providers.length === 0 ? (
                <option value="">{t("appointments.noProviders", "No dentists for this branch")}</option>
              ) : (
                providers.map((p) => (
                  <option key={p.profile_id} value={p.profile_id}>
                    {p.full_name ?? p.email ?? "Dentist"}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">{t("appointments.date", "Date")}</label>
            <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium">{t("appointments.availableSlots", "Available Slots")}</label>
            {!providerId || !date ? (
              <p className="text-xs text-neutral-500">
                {t("appointments.selectDentistAndDate", "Select dentist and date.")}
              </p>
            ) : (
              <>
                <AppointmentSlotButtons
                  slots={slots}
                  selectedTime={time}
                  onSelect={setTime}
                  currentTime={originalDate === date ? originalTime : undefined}
                  date={date}
                  loading={slotsLoading}
                />
                {!slotsLoading && slots.length === 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 gap-1.5"
                    disabled={configuringSlots}
                    onClick={() => void handleConfigureSlots()}
                  >
                    {configuringSlots ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {t("common.loading", "Loading…")}
                      </>
                    ) : (
                      t("appointments.configureSlots", "Configure working hours & slots")
                    )}
                  </Button>
                ) : null}
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">{t("appointments.purpose", "Purpose")}</label>
            <select
              value={selectedPurposeOption}
              onChange={(e) => setSelectedPurposeOption(e.target.value)}
              className="flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {PRESET_PURPOSES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {selectedPurposeOption === "Other" ? (
              <Input
                placeholder="Specify other purpose..."
                value={customPurpose}
                onChange={(e) => setCustomPurpose(e.target.value)}
                required
                className="mt-2"
              />
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-100">
            <Button
              type="submit"
              disabled={saving || !providerId || (!canPickTime && !scheduleUnchanged)}
            >
              {saving ? t("common.saving", "Saving…") : t("common.save", "Save")}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel", "Cancel")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
