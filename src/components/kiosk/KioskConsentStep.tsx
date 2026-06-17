"use client"

import * as React from "react"
import { CheckCircle2, FileSignature, Loader2 } from "lucide-react"
import { useLocale } from "@/hooks/use-locale"
import { Badge } from "@/components/ui/badge"
import {
  createKioskConsentSignToken,
  fetchKioskConsentSnapshot,
  hasPendingKioskConsents,
  type PortalSnapshot,
} from "@/lib/kiosk/kiosk-consent-service"
import { saveKioskSignReturn } from "@/lib/kiosk/kiosk-sign-return"
import { notify } from "@/lib/ui/notify"

type KioskConsentStepProps = {
  kioskToken: string
  sessionId: string
  phone: string
  lastName: string
  branchName: string
  initialSnapshot: PortalSnapshot | null
  onBack: () => void
  onAllSigned: () => void
}

export function KioskConsentStep({
  kioskToken,
  sessionId,
  phone,
  lastName,
  branchName,
  initialSnapshot,
  onBack,
  onAllSigned,
}: KioskConsentStepProps) {
  const { t } = useLocale()
  const [snapshot, setSnapshot] = React.useState<PortalSnapshot | null>(initialSnapshot)
  const [loading, setLoading] = React.useState(!initialSnapshot)
  const [signingSlug, setSigningSlug] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    const { data, error } = await fetchKioskConsentSnapshot(sessionId, phone, lastName)
    setSnapshot(data)
    setLoading(false)
    if (error) {
      notify.error(error)
      return
    }
    if (data && !hasPendingKioskConsents(data)) {
      onAllSigned()
    }
  }, [sessionId, phone, lastName, onAllSigned])

  React.useEffect(() => {
    if (!initialSnapshot) {
      void load()
      return
    }
    if (!hasPendingKioskConsents(initialSnapshot)) {
      onAllSigned()
    }
  }, [initialSnapshot, load, onAllSigned])

  const handleSign = async (slug: string) => {
    setSigningSlug(slug)
    const { data, error } = await createKioskConsentSignToken(sessionId, phone, lastName, slug)
    setSigningSlug(null)
    if (error) {
      notify.error(error)
      return
    }
    if (data?.already_signed) {
      notify.success(t("kiosk.consentAlreadySigned", "This form is already signed."))
      void load()
      return
    }
    if (data?.token) {
      saveKioskSignReturn({ kioskToken, phone, lastName })
      window.location.href = `/sign/${data.token}?from=kiosk`
    }
  }

  if (loading && !snapshot) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-[2rem] border border-white bg-white/70 p-10 text-neutral-600 shadow-[0_8px_40px_rgb(0,0,0,0.08)] backdrop-blur-2xl">
        <Loader2 className="h-10 w-10 animate-spin text-primary-500" />
        <p className="text-lg font-medium">
          {t("kiosk.consentLoading", "Loading required forms…")}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-[2rem] border border-white bg-white/70 p-10 shadow-[0_8px_40px_rgb(0,0,0,0.08)] backdrop-blur-2xl animate-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-100">
          <FileSignature className="h-7 w-7 text-primary-600" aria-hidden />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">
          {t("kiosk.consentTitle", "Sign required forms")}
        </h1>
        <p className="mt-2 text-base text-neutral-500">
          {t(
            "kiosk.consentHint",
            "Please review and sign each form below before check-in."
          )}
        </p>
        <p className="mt-1 text-sm font-medium text-primary-700">{branchName}</p>
      </div>

      <ul className="space-y-3">
        {(snapshot?.consents ?? []).map((item) => {
          const signed = item.status === "signed"
          const pending = item.status === "pending" || item.status === "not_started"
          return (
            <li
              key={item.slug}
              className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-100 bg-white/90 px-4 py-4 shadow-sm"
            >
              <span className="text-base font-medium text-neutral-800">{item.name}</span>
              {signed ? (
                <Badge variant="success" className="gap-1 px-3 py-1 text-sm">
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  {t("consent.signed", "Signed")}
                </Badge>
              ) : pending ? (
                <button
                  type="button"
                  disabled={signingSlug === item.slug}
                  onClick={() => void handleSign(item.slug)}
                  className="h-12 min-w-[7rem] rounded-xl bg-primary-600 px-4 text-sm font-bold text-white shadow-md transition active:scale-[0.98] disabled:opacity-60"
                >
                  {signingSlug === item.slug ? (
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  ) : (
                    t("kiosk.signForm", "Sign")
                  )}
                </button>
              ) : (
                <Badge variant="outline">{item.status}</Badge>
              )}
            </li>
          )
        })}
      </ul>

      {snapshot?.ready_for_checkin ? (
        <p className="mt-6 text-center text-sm font-semibold text-emerald-800">
          {t("kiosk.consentsComplete", "All forms signed — continuing check-in…")}
        </p>
      ) : (
        <p className="mt-6 text-center text-sm text-amber-800">
          {t("kiosk.consentsRequired", "Both forms must be signed to check in.")}
        </p>
      )}

      <button
        type="button"
        onClick={onBack}
        className="mt-6 w-full h-12 text-base font-bold text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100/50 rounded-xl transition-all active:scale-[0.98]"
      >
        {t("kiosk.back", "Back")}
      </button>
    </div>
  )
}
