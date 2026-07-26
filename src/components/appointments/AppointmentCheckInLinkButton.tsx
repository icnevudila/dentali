"use client"

import * as React from "react"
import { Copy, Link2, Loader2, Printer, QrCode } from "lucide-react"
import QRCode from "qrcode"
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
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null)
  const printRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!url) {
      setQrDataUrl(null)
      return
    }
    let cancelled = false
    void QRCode.toDataURL(url, { width: 220, margin: 1, errorCorrectionLevel: "M" })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [url])

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

  const printQr = () => {
    if (!printRef.current || !qrDataUrl) return
    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=480,height=640")
    if (!printWindow) {
      notify.error(t("checkin.printBlocked", "Print window was blocked by the browser."))
      return
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>${t("checkin.qrTitle", "Check-in QR")}</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:24px;">
        <h1 style="font-size:18px;margin-bottom:8px;">${t("checkin.qrTitle", "Check-in QR")}</h1>
        <p style="font-size:12px;color:#555;margin-bottom:16px;">${t("checkin.qrPrintHint", "Scan to open the patient check-in page.")}</p>
        <img src="${qrDataUrl}" alt="Check-in QR code" width="220" height="220" />
      </body></html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  return (
    <div className="flex flex-col gap-2">
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

      {url && qrDataUrl ? (
        <div
          ref={printRef}
          className="inline-flex w-fit flex-col items-center gap-2 rounded-lg border border-neutral-200 bg-white p-3"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt={t("checkin.qrAlt", "Check-in QR code")}
            width={160}
            height={160}
            className="rounded-md"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={printQr}>
              <Printer className="h-3.5 w-3.5" aria-hidden />
              {t("checkin.printQr", "Print QR")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
