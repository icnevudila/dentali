"use client"

import * as React from "react"
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  FileSignature,
  ListOrdered,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useLocale } from "@/hooks/use-locale"
import {
  createPortalConsentSignToken,
  fetchPortalSnapshot,
  type PortalSnapshot,
} from "@/lib/portal/portal-status-service"
import { notify } from "@/lib/ui/notify"

type PortalStatusPanelProps = {
  sessionId: string
  phone: string
  lastName: string
  branchName: string
  onBack: () => void
  onBookAppointment: () => void
}

function queueStatusLabel(status: string, t: (k: string, f: string) => string): string {
  const map: Record<string, string> = {
    waiting: t("portal.queueWaiting", "Waiting"),
    ready: t("portal.queueReady", "Ready to be called"),
    now_serving: t("portal.queueServing", "Now serving"),
    in_chair: t("portal.queueInChair", "In treatment"),
  }
  return map[status] ?? status
}

export function PortalStatusPanel({
  sessionId,
  phone,
  lastName,
  branchName,
  onBack,
  onBookAppointment,
}: PortalStatusPanelProps) {
  const { t } = useLocale()
  const [snapshot, setSnapshot] = React.useState<PortalSnapshot | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [signingSlug, setSigningSlug] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    const { data, error } = await fetchPortalSnapshot(sessionId, phone, lastName)
    setSnapshot(data)
    setLoading(false)
    if (error) notify.error(error)
  }, [sessionId, phone, lastName])

  React.useEffect(() => {
    void load()
    const interval = window.setInterval(() => void load(), 30_000)
    return () => window.clearInterval(interval)
  }, [load])

  const handleSign = async (slug: string) => {
    setSigningSlug(slug)
    const { data, error } = await createPortalConsentSignToken(sessionId, phone, lastName, slug)
    setSigningSlug(null)
    if (error) {
      notify.error(error)
      return
    }
    if (data?.already_signed) {
      notify.success(t("portal.consentAlreadySigned", "This form is already signed."))
      void load()
      return
    }
    if (data?.token) {
      window.location.href = `/sign/${data.token}`
    }
  }

  if (loading && !snapshot) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-neutral-600">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        <p>{t("portal.statusLoading", "Loading your visit status…")}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label={t("common.back", "Back")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">
            {t("portal.statusTitle", "My visit")}
          </h1>
          <p className="text-sm text-neutral-500">{branchName}</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="ml-auto gap-1" onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          {t("common.refresh", "Refresh")}
        </Button>
      </div>

      {snapshot ? (
        <p className="text-sm text-neutral-700">
          {t("portal.statusGreeting", "Hello, {name}").replace("{name}", snapshot.patient_name)}
        </p>
      ) : null}

      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <ListOrdered className="h-4 w-4 text-primary-600" aria-hidden />
          {t("portal.queueSection", "Queue")}
        </h2>
        {snapshot?.queue ? (
          <div className="mt-3 space-y-2">
            <p className="text-3xl font-bold tabular-nums text-primary-700">
              #{snapshot.queue.display_code}
            </p>
            <Badge variant="info">{queueStatusLabel(snapshot.queue.status, t)}</Badge>
            {snapshot.queue.ahead_count > 0 ? (
              <p className="text-sm text-neutral-600">
                {t("portal.queueAhead", "{count} ahead of you").replace(
                  "{count}",
                  String(snapshot.queue.ahead_count)
                )}
              </p>
            ) : (
              <p className="text-sm text-emerald-700">
                {t("portal.queueNext", "You're next in line")}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-neutral-600">
            {t("portal.notInQueue", "You're not checked in today. Book an appointment or check in at the kiosk.")}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <CreditCard className="h-4 w-4 text-primary-600" aria-hidden />
          {t("portal.balanceSection", "Balance")}
        </h2>
        <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-900">
          ₱{(snapshot?.balance.open_balance ?? 0).toLocaleString()}
        </p>
        {snapshot?.balance.has_balance ? (
          <p className="mt-1 text-xs text-amber-800">
            {t("portal.balanceDue", "Outstanding balance — settle at the front desk before leaving.")}
          </p>
        ) : (
          <p className="mt-1 text-xs text-emerald-700">
            {t("portal.balanceClear", "No open balance on file.")}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <FileSignature className="h-4 w-4 text-primary-600" aria-hidden />
          {t("portal.consentSection", "Required forms")}
        </h2>
        <ul className="mt-3 space-y-2">
          {(snapshot?.consents ?? []).map((item) => {
            const signed = item.status === "signed"
            const pending = item.status === "pending" || item.status === "not_started"
            return (
              <li
                key={item.slug}
                className="flex items-center justify-between gap-2 rounded-lg border border-neutral-100 px-3 py-2"
              >
                <span className="text-sm text-neutral-800">{item.name}</span>
                {signed ? (
                  <Badge variant="success" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" aria-hidden />
                    {t("consent.signed", "Signed")}
                  </Badge>
                ) : pending ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={signingSlug === item.slug}
                    onClick={() => void handleSign(item.slug)}
                  >
                    {signingSlug === item.slug ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      t("portal.signNow", "Sign now")
                    )}
                  </Button>
                ) : (
                  <Badge variant="outline">{item.status}</Badge>
                )}
              </li>
            )
          })}
        </ul>
        {snapshot?.ready_for_checkin ? (
          <p className="mt-3 text-xs text-emerald-800">
            {t("portal.consentsReady", "Intake forms complete — you're ready for check-in.")}
          </p>
        ) : (
          <p className="mt-3 text-xs text-amber-800">
            {t("portal.consentsPending", "Sign the forms above before your visit or at check-in.")}
          </p>
        )}
      </section>

      <Button type="button" className="w-full" onClick={onBookAppointment}>
        {t("portal.bookAnother", "Book an appointment")}
      </Button>
    </div>
  )
}
