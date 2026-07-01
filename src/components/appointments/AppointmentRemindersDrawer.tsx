"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { X, MessageCircle, Clock, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useLocale } from "@/hooks/use-locale"
import { useBranch } from "@/hooks/use-branch"
import { type AppointmentRecord } from "@/lib/appointments/appointment-service"
import { type StaffMember } from "@/lib/staff/staff-service"
import { logManualWhatsAppNotification } from "@/lib/notifications/notification-service"
import { buildWhatsAppSendUrl } from "@/lib/notifications/whatsapp"
import { addDays, toDateKey } from "@/lib/appointments/week-calendar"
import { toast } from "sonner"

interface AppointmentRemindersDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointments: AppointmentRecord[]
  staffMembers: StaffMember[]
  onActionComplete: () => void
}

export function AppointmentRemindersDrawer({
  open,
  onOpenChange,
  appointments,
  staffMembers,
  onActionComplete,
}: AppointmentRemindersDrawerProps) {
  const { t } = useLocale()
  const { activeBranch } = useBranch()

  // Filter tomorrow's active/scheduled appointments
  const tomorrowKey = toDateKey(addDays(new Date(), 1))

  const tomorrowAppointments = React.useMemo(() => {
    return appointments.filter((appt) => {
      const apptDateKey = appt.scheduled_at.slice(0, 10)
      return apptDateKey === tomorrowKey && (appt.status === "scheduled" || appt.status === "confirmed")
    })
  }, [appointments, tomorrowKey])

  const getProviderName = (providerId: string | null | undefined) => {
    if (!providerId) return "Any dentist"
    const staff = staffMembers.find((s) => s.profile_id === providerId)
    return staff?.full_name || "Any dentist"
  }

  const handleWhatsApp = async (appt: AppointmentRecord) => {
    if (!activeBranch || !appt.patient_phone) return
    
    const scheduled = new Date(appt.scheduled_at)
    const appointmentDate = scheduled.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "Asia/Manila",
    })
    const appointmentTime = scheduled.toLocaleTimeString("en-PH", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Manila",
    })

    const body = t(
      "appointments.whatsAppReminderBody",
      "Hello {patient}, this is a reminder for your dental appointment at {clinic} on {date} at {time}."
    )
      .replace("{patient}", appt.patient_name ?? "patient")
      .replace("{clinic}", activeBranch.name)
      .replace("{date}", appointmentDate)
      .replace("{time}", appointmentTime)

    const { error: logError } = await logManualWhatsAppNotification({
      phone: appt.patient_phone,
      body,
      branchId: activeBranch.id,
      templateKey: "appointment_reminder",
      patientId: appt.patient_id,
    })

    if (logError) {
      toast.error(logError)
      return
    }

    const win = window.open(buildWhatsAppSendUrl(appt.patient_phone, body), "_blank", "noopener,noreferrer")
    if (!win) {
      toast.error(t("settings.notificationsPopupBlocked", "WhatsApp popup was blocked by the browser."))
    } else {
      toast.success("Reminder logged & WhatsApp dispatcher opened!")
      onActionComplete()
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

      {/* Drawer */}
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l bg-white shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">
              {t("appointments.remindersTitle", "Tomorrow's Reminders")}
            </h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              {tomorrowKey} · {tomorrowAppointments.length} {t("appointments.pendingReminders", "pending")}
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
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {tomorrowAppointments.length > 0 ? (
            <div className="space-y-3">
              {tomorrowAppointments.map((appt) => {
                const timeStr = new Date(appt.scheduled_at).toLocaleTimeString("en-PH", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Asia/Manila",
                })

                return (
                  <div
                    key={appt.id}
                    className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-4 space-y-3 shadow-sm hover:bg-neutral-50 transition-colors"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="font-semibold text-neutral-900">{appt.patient_name}</p>
                        <p className="text-xs text-neutral-500 mt-0.5">{appt.patient_phone || "No phone number"}</p>
                      </div>
                      <Badge variant="outline" className="text-xs font-normal bg-white">
                        {appt.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-white rounded-lg p-2.5 border border-neutral-100">
                      <div className="flex items-center gap-1.5 text-neutral-600">
                        <Clock className="w-3.5 h-3.5 text-neutral-400" />
                        <span>{timeStr}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-neutral-600">
                        <User className="w-3.5 h-3.5 text-neutral-400" />
                        <span className="truncate">{getProviderName(appt.provider_id)}</span>
                      </div>
                    </div>

                    {appt.patient_phone ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 gap-1.5 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100"
                          variant="ghost"
                          onClick={() => void handleWhatsApp(appt)}
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          {t("appointments.sendWhatsApp", "Send WhatsApp")}
                        </Button>
                      </div>
                    ) : (
                      <p className="text-[11px] text-amber-600 italic">
                        * Cannot send reminder: patient phone number missing.
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-neutral-500 border border-dashed rounded-xl bg-neutral-50/50">
              <Clock className="h-10 w-10 mx-auto mb-3 text-neutral-300" />
              <p className="font-medium text-neutral-800">
                {t("appointments.noRemindersTitle", "All caught up")}
              </p>
              <p className="mt-1 text-xs text-neutral-500 px-4">
                {t("appointments.noRemindersHint", "No scheduled or confirmed appointments found for tomorrow.")}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-neutral-50/60 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            {t("common.close", "Close")}
          </Button>
        </div>
      </aside>
    </div>,
    document.body
  )
}
