"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { MessageCircle, Phone, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/use-locale"
import { useBranch } from "@/hooks/use-branch"
import { useAuth } from "@/hooks/use-auth"
import { buildWhatsAppSendUrl } from "@/lib/notifications/whatsapp"
import { logPatientOutreach } from "@/lib/notifications/outreach-service"
import { notify } from "@/lib/ui/notify"

const PRESETS = [
  {
    id: "reminder",
    labelKey: "outreach.presetReminder",
    labelFallback: "Appointment reminder",
    body: (name: string, clinic: string) =>
      `Hi ${name}, this is a reminder from ${clinic}. Please reply if you need to reschedule. Salamat!`,
  },
  {
    id: "noshow",
    labelKey: "outreach.presetNoShow",
    labelFallback: "No-show rebook",
    body: (name: string, clinic: string) =>
      `Hi ${name}, we missed you at ${clinic}. Reply here to book a new visit.`,
  },
  {
    id: "balance",
    labelKey: "outreach.presetBalance",
    labelFallback: "Balance follow-up",
    body: (name: string, clinic: string) =>
      `Hi ${name}, ${clinic} here — you have an open balance. Message us to arrange payment. Thank you!`,
  },
] as const

type PatientOutreachCardProps = {
  patientId: string
  patientName: string
  phone: string | null | undefined
  className?: string
}

export function PatientOutreachCard({
  patientId,
  patientName,
  phone,
}: PatientOutreachCardProps) {
  const { t } = useLocale()
  const { activeBranch } = useBranch()
  const { user } = useAuth()
  const [open, setOpen] = React.useState(false)
  const [busyId, setBusyId] = React.useState<string | null>(null)

  const clinicName = activeBranch?.name ?? "our clinic"
  const firstName = patientName.trim().split(/\s+/)[0] || "there"

  React.useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  const openWhatsApp = async (presetId: string, body: string) => {
    if (!phone?.trim()) {
      notify.error(t("outreach.noPhone", "This patient has no phone number on file."))
      return
    }
    if (!activeBranch || !user) return

    setBusyId(presetId)
    const url = buildWhatsAppSendUrl(phone, body)
    const { error } = await logPatientOutreach({
      organizationId: activeBranch.organization_id,
      branchId: activeBranch.id,
      patientId,
      phone,
      bodyPreview: body.slice(0, 240),
      templateKey: `whatsapp_${presetId}`,
      createdBy: user.id,
    })
    setBusyId(null)
    if (error) {
      notify.error(error)
      return
    }
    setOpen(false)
    window.open(url, "_blank", "noopener,noreferrer")
    notify.success(t("outreach.opened", "WhatsApp opened — outreach logged in Inbox."))
  }

  const dialog = open ? (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-neutral-950/40"
        aria-label={t("common.close", "Close")}
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="patient-outreach-title"
        className="relative z-10 w-full max-w-md rounded-t-2xl border border-neutral-200 bg-white p-4 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="patient-outreach-title" className="text-sm font-semibold text-neutral-950">
              {t("outreach.title", "Patient outreach")}
            </h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-600">
              <Phone className="h-3 w-3" aria-hidden />
              {phone?.trim() || t("outreach.noPhoneShort", "No phone on file")}
            </p>
          </div>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="mb-3 text-xs text-neutral-500">
          {t(
            "outreach.hint",
            "Opens WhatsApp with a ready message. No paid WhatsApp API — logged for the clinic inbox."
          )}
        </p>
        <div className="flex flex-col gap-1.5">
          {PRESETS.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              variant="outline"
              className="h-9 justify-start"
              disabled={!phone?.trim() || busyId === preset.id}
              onClick={() => void openWhatsApp(preset.id, preset.body(firstName, clinicName))}
            >
              {t(preset.labelKey, preset.labelFallback)}
            </Button>
          ))}
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5"
        onClick={() => setOpen(true)}
      >
        <MessageCircle className="h-3.5 w-3.5" />
        {t("outreach.title", "Patient outreach")}
      </Button>
      {typeof document !== "undefined" && dialog ? createPortal(dialog, document.body) : null}
    </>
  )
}
