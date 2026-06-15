"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { useLocale } from "@/hooks/use-locale"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, X } from "lucide-react"
import { toast } from "sonner"
import {
  rescheduleAppointment,
  updateAppointmentDetails,
  type AppointmentRecord,
} from "@/lib/appointments/appointment-service"
import {
  fetchAvailableAppointmentSlots,
  type AppointmentSlot,
} from "@/lib/appointments/provider-availability-service"
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
  onOpenChange: (open: boolean) => void
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
  const [date, setDate] = React.useState("")
  const [time, setTime] = React.useState("")
  const [slots, setSlots] = React.useState<AppointmentSlot[]>([])
  const [slotsLoading, setSlotsLoading] = React.useState(false)

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

  React.useEffect(() => {
    if (!open || !appointment) return
    setProviderId(appointment.provider_id || "")
    setPurpose(appointment.purpose || "")
    setDate(appointmentDateKey(appointment.scheduled_at))
    setTime(extract24HourTime(appointment.scheduled_at))
  }, [open, appointment, extract24HourTime])

  React.useEffect(() => {
    if (!open || !branchId || !providerId || !date || !appointment) {
      setSlots([])
      return
    }
    setSlotsLoading(true)
    fetchAvailableAppointmentSlots({
      branchId,
      providerId,
      date,
      excludeAppointmentId: appointment.id,
    }).then(({ data }) => {
      setSlots(data)
      setSlotsLoading(false)
    })
  }, [open, branchId, providerId, date, appointment])

  if (!open || !mounted || !appointment) return null

  const originalDate = appointmentDateKey(appointment.scheduled_at)
  const originalTime = extract24HourTime(appointment.scheduled_at)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const { error: err1 } = await updateAppointmentDetails(appointment.id, {
      providerId: providerId || null,
      purpose,
    })

    if (err1) {
      toast.error(err1)
      setSaving(false)
      return
    }

    let scheduledAt = appointment.scheduled_at
    if (date !== originalDate || time !== originalTime) {
      scheduledAt = new Date(`${date}T${time}:00+08:00`).toISOString()
      const { error: err2 } = await rescheduleAppointment(appointment.id, scheduledAt)
      if (err2) {
        toast.error(err2)
        setSaving(false)
        return
      }
      onFreedSlot?.(appointment.scheduled_at)
    }

    toast.success(t("appointments.updateSuccess", "Appointment updated successfully"))
    onSaved({
      ...appointment,
      provider_id: providerId || null,
      purpose,
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
              className="flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">{t("appointments.anyProvider", "Any dentist")}</option>
              {providers.map((p) => (
                <option key={p.profile_id} value={p.profile_id}>
                  {p.full_name ?? p.email ?? "Dentist"}
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
            {!providerId || !date ? (
              <p className="text-xs text-neutral-500">
                {t("appointments.selectDentistAndDate", "Select dentist and date.")}
              </p>
            ) : (
              <AppointmentSlotButtons
                slots={slots}
                selectedTime={time}
                onSelect={setTime}
                currentTime={originalDate === date ? originalTime : undefined}
                loading={slotsLoading}
              />
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">{t("appointments.purpose", "Purpose")}</label>
            <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-100">
            <Button type="submit" disabled={saving || !time}>
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
