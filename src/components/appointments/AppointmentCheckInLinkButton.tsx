"use client"

import * as React from "react"
import { Copy, Link2, Loader2, QrCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  buildCheckInUrl,
  createAppointmentCheckInToken,
} from "@/lib/appointments/checkin-token-service"
import { buildWhatsAppSendUrl } from "@/lib/notifications/whatsapp"
import { notify } from "@/lib/ui/notify"
import { useLocale } from "@/hooks/use-locale"

type AppointmentCheckInLinkButtonProps = {
  appointmentId: string
  patientPhone?: string | null
  patientName?: string
}

export function AppointmentCheckInLinkButton({
  appointmentId,
  patientPhone,
  patientName,
}: AppointmentCheckInLinkButtonProps) {
  const { t } = useLocale()
  const [busy, setBusy] = React.useState(false)
  const [url, setUrl] = React.useState<string | null>(null)

  const createLink = async () => {
    setBusy(true)
    const { data, error } = await createAppointmentCheckInToken(appointmentId)
    setBusy(false)
    if (error || !data) {
      notify.error(error ?? t("checkin.linkFailed", "Could not create check-in link"))
      return null
    }
    const next = buildCheckInUrl(data.token)
    setUrl(next)
    return next
  }

  const copyLink = async () => {
    const link = url ?? (await createLink())
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      notify.success(t("checkin.linkCopied", "Check-in link copied"))
    } catch {
      notify.error(t("checkin.copyFailed", "Could not copy link"))
    }
  }

  const sendWhatsApp = async () => {
    if (!patientPhone?.trim()) {
      notify.error(t("outreach.noPhone", "This patient has no phone number on file."))
      return
    }
    const link = url ?? (await createLink())
    if (!link) return
    const name = patientName?.trim().split(/\s+/)[0] || "there"
    const body = `Hi ${name}, check in for your dental visit here: ${link}`
    window.open(buildWhatsAppSendUrl(patientPhone, body), "_blank", "noopener,noreferrer")
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 text-xs"
        disabled={busy}
        onClick={() => void copyLink()}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <QrCode className="h-3.5 w-3.5" aria-hidden />
        )}
        {t("checkin.copyLink", "Check-in link")}
      </Button>
      {patientPhone ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 text-xs"
          disabled={busy}
          onClick={() => void sendWhatsApp()}
        >
          <Link2 className="h-3.5 w-3.5" aria-hidden />
          {t("checkin.whatsapp", "WhatsApp")}
        </Button>
      ) : null}
      {url ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 gap-1 text-xs"
          onClick={() => void navigator.clipboard.writeText(url)}
        >
          <Copy className="h-3.5 w-3.5" aria-hidden />
        </Button>
      ) : null}
    </div>
  )
}
