"use client"

import * as React from "react"
import { MessageCircle, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
  className,
}: PatientOutreachCardProps) {
  const { t } = useLocale()
  const { activeBranch } = useBranch()
  const { user } = useAuth()
  const [busyId, setBusyId] = React.useState<string | null>(null)

  const clinicName = activeBranch?.name ?? "our clinic"
  const firstName = patientName.trim().split(/\s+/)[0] || "there"

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
    window.open(url, "_blank", "noopener,noreferrer")
    notify.success(t("outreach.opened", "WhatsApp opened — outreach logged in Inbox."))
  }

  return (
    <Card className={className}>
      <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <MessageCircle className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
          <p className="text-sm font-semibold text-neutral-900">
            {t("outreach.title", "Patient outreach")}
          </p>
          <span className="hidden text-neutral-300 sm:inline" aria-hidden>
            ·
          </span>
          <p
            className="flex min-w-0 items-center gap-1.5 truncate text-xs text-neutral-600"
            title={t(
              "outreach.hint",
              "Opens WhatsApp with a ready message. No paid WhatsApp API — logged for the clinic inbox."
            )}
          >
            <Phone className="h-3 w-3 shrink-0 text-neutral-400" aria-hidden />
            {phone?.trim() || t("outreach.noPhoneShort", "No phone on file")}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={!phone?.trim() || busyId === preset.id}
              onClick={() =>
                void openWhatsApp(preset.id, preset.body(firstName, clinicName))
              }
            >
              {t(preset.labelKey, preset.labelFallback)}
            </Button>
          ))}
        </div>
      </div>
    </Card>
  )
}
