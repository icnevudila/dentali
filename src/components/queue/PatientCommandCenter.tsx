"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  FileSignature,
  Loader2,
  ShieldCheck,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/use-locale"
import {
  fetchCheckInReadiness,
  type CheckInReadiness,
} from "@/lib/patients/checkin-readiness-service"
import { cn } from "@/lib/utils"

type PatientCommandCenterProps = {
  patientId: string
  branchId: string
  className?: string
  onOpenConsent?: (href: string) => void
}

function statusBadge(
  status: string,
  t: (key: string, fallback: string) => string
): { label: string; variant: "success" | "warning" | "outline" } {
  if (status === "signed") {
    return { label: t("consent.signed", "Signed"), variant: "success" }
  }
  if (status === "pending") {
    return { label: t("consent.pending", "Awaiting signature"), variant: "warning" }
  }
  return { label: t("consent.notStarted", "Not started"), variant: "outline" }
}

export function PatientCommandCenter({
  patientId,
  branchId,
  className,
  onOpenConsent,
}: PatientCommandCenterProps) {
  const { t } = useLocale()
  const [readiness, setReadiness] = React.useState<CheckInReadiness | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void fetchCheckInReadiness(patientId, branchId).then(({ data, error: err }) => {
      if (cancelled) return
      setReadiness(data)
      setError(err)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [patientId, branchId])

  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-3 text-sm text-neutral-600",
          className
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t("queue.commandCenterLoading", "Preparing check-in summary…")}
      </div>
    )
  }

  if (error || !readiness) {
    return (
      <div className={cn("rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900", className)}>
        {error ?? t("queue.commandCenterError", "Could not load check-in summary.")}
      </div>
    )
  }

  const apptTime = readiness.todayAppointment
    ? new Date(readiness.todayAppointment.time).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null

  return (
    <section
      className={cn(
        "space-y-3 rounded-xl border p-4",
        readiness.ready
          ? "border-emerald-200 bg-emerald-50/50"
          : "border-amber-200 bg-amber-50/40",
        className
      )}
      aria-label={t("queue.commandCenterTitle", "Check-in readiness")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-neutral-900">
            {t("queue.commandCenterTitle", "Check-in readiness")}
          </p>
          <p className="text-xs text-neutral-600">
            {readiness.ready
              ? t("queue.commandCenterReady", "No blockers — ready to check in.")
              : t("queue.commandCenterBlocked", "Resolve items below before check-in.")}
          </p>
        </div>
        {readiness.ready ? (
          <Badge variant="success" className="gap-1 shrink-0">
            <ShieldCheck className="h-3 w-3" aria-hidden />
            {t("queue.readyBadge", "Ready")}
          </Badge>
        ) : (
          <Badge variant="warning" className="gap-1 shrink-0">
            <AlertCircle className="h-3 w-3" aria-hidden />
            {t("queue.actionNeeded", "Action needed")}
          </Badge>
        )}
      </div>

      <ul className="space-y-2 text-sm">
        {readiness.consents.map((item) => {
          const badge = statusBadge(item.status, t)
          return (
            <li
              key={item.slug}
              className="flex items-center justify-between gap-2 rounded-lg border border-white/60 bg-white/70 px-3 py-2"
            >
              <span className="flex min-w-0 items-center gap-2 text-neutral-800">
                <FileSignature className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden />
                <span className="truncate">{item.label}</span>
              </span>
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </li>
          )
        })}

        <li className="flex items-center justify-between gap-2 rounded-lg border border-white/60 bg-white/70 px-3 py-2">
          <span className="flex items-center gap-2 text-neutral-800">
            <CreditCard className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden />
            {t("queue.commandCenterBalance", "Outstanding balance")}
          </span>
          <span className="tabular-nums font-medium text-neutral-900">
            ₱{readiness.billing.openBalance.toLocaleString()}
          </span>
        </li>

        {readiness.todayAppointment ? (
          <li className="flex items-center justify-between gap-2 rounded-lg border border-white/60 bg-white/70 px-3 py-2">
            <span className="flex items-center gap-2 text-neutral-800">
              <Clock className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden />
              {t("queue.commandCenterAppt", "Today's appointment")}
            </span>
            <span className="text-right text-xs text-neutral-700">
              <span className="block font-medium tabular-nums">{apptTime}</span>
              {readiness.todayAppointment.providerName ? (
                <span className="text-neutral-500">{readiness.todayAppointment.providerName}</span>
              ) : null}
            </span>
          </li>
        ) : null}
      </ul>

      {!readiness.consentReady ? (
        onOpenConsent ? (
          <Button
            type="button"
            size="sm"
            className="w-full gap-2"
            onClick={() => onOpenConsent(readiness.consentHref)}
          >
            <FileSignature className="h-4 w-4" aria-hidden />
            {t("queue.openRequiredConsent", "Sign required consent")}
          </Button>
        ) : (
          <Button asChild size="sm" className="w-full gap-2">
            <Link href={readiness.consentHref}>
              <FileSignature className="h-4 w-4" aria-hidden />
              {t("queue.openRequiredConsent", "Sign required consent")}
            </Link>
          </Button>
        )
      ) : readiness.ready ? (
        <p className="flex items-center gap-2 text-xs text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          {t("queue.commandCenterAllClear", "Intake consents signed. Proceed with check-in.")}
        </p>
      ) : null}
    </section>
  )
}
