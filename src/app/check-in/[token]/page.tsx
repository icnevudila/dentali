"use client"

import * as React from "react"
import { CheckCircle2, Loader2, QrCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { useRouteParams } from "@/hooks/use-route-params"
import {
  checkInPublicErrorMessage,
  fetchCheckInByToken,
  redeemCheckInToken,
  type CheckInTokenPreview,
} from "@/lib/appointments/checkin-token-service"

export default function PublicCheckInPage() {
  const { token } = useRouteParams<{ token: string }>()
  const [loading, setLoading] = React.useState(true)
  const [redeeming, setRedeeming] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [preview, setPreview] = React.useState<CheckInTokenPreview | null>(null)
  const [done, setDone] = React.useState<{
    displayCode?: string
    alreadyInQueue?: boolean
  } | null>(null)

  React.useEffect(() => {
    if (!token) return
    void fetchCheckInByToken(token).then(({ data, error: err }) => {
      if (err || !data) {
        setError(checkInPublicErrorMessage(err ?? "invalid"))
        setLoading(false)
        return
      }
      setPreview(data)
      setLoading(false)
    })
  }, [token])

  const handleCheckIn = async () => {
    if (!token) return
    setRedeeming(true)
    setError(null)
    const { data, error: err } = await redeemCheckInToken(token)
    setRedeeming(false)
    if (err || !data) {
      setError(checkInPublicErrorMessage(err ?? "redeem_failed"))
      return
    }
    setDone({
      displayCode: data.display_code,
      alreadyInQueue: data.already_in_queue,
    })
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center p-6">
        <PageLoadingSkeleton variant="compact" />
      </main>
    )
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden />
        <h1 className="text-xl font-semibold text-neutral-900">You&apos;re checked in</h1>
        <p className="text-sm text-neutral-600">
          {done.alreadyInQueue
            ? "You were already on the clinic queue. Please wait to be called."
            : "Please have a seat. The front desk will call your number."}
        </p>
        {done.displayCode ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-2xl font-bold tracking-wide text-emerald-900">
            {done.displayCode}
          </p>
        ) : null}
      </main>
    )
  }

  if (error || !preview) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 p-6 text-center">
        <QrCode className="mx-auto h-10 w-10 text-neutral-400" aria-hidden />
        <h1 className="text-lg font-semibold text-neutral-900">Check-in unavailable</h1>
        <p className="text-sm text-neutral-600">{error ?? checkInPublicErrorMessage("invalid")}</p>
        <p className="text-xs text-neutral-500">
          Please see the front desk — they can check you in on the queue board.
        </p>
      </main>
    )
  }

  const name = `${preview.patient_first_name} ${preview.patient_last_name}`.trim()
  const when = preview.scheduled_at
    ? new Date(preview.scheduled_at).toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—"

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 p-6">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
          {preview.branch_name}
        </p>
        <h1 className="mt-1 text-xl font-semibold text-neutral-900">Self check-in</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Confirm your visit and join the clinic queue.
        </p>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-neutral-500">Patient</p>
        <p className="text-base font-semibold text-neutral-900">{name || "Patient"}</p>
        <p className="mt-3 text-sm text-neutral-500">Appointment</p>
        <p className="text-sm font-medium text-neutral-800">{when}</p>
      </div>

      <Button
        type="button"
        size="lg"
        className="h-12 w-full gap-2"
        disabled={redeeming}
        onClick={() => void handleCheckIn()}
      >
        {redeeming ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <QrCode className="h-4 w-4" aria-hidden />
        )}
        Check in now
      </Button>
    </main>
  )
}
