"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleDot,
  ClipboardList,
  DoorClosed,
  FileText,
  FlaskConical,
  Loader2,
  Receipt,
  RotateCcw,
  Stethoscope,
  UserCheck,
  Wallet,
  XCircle,
} from "lucide-react"
import { addTransitionType, startTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useLocale } from "@/hooks/use-locale"
import { formatDate } from "@/lib/i18n/translate"
import { notify } from "@/lib/ui/notify"
import { cn } from "@/lib/utils"
import {
  cancelPatientEncounter,
  encounterPublicId,
  fetchEncounterDetail,
  fetchPatientEncounters,
  reopenPatientEncounter,
  type PatientEncounterDetail,
  type PatientEncounterSummary,
} from "@/lib/clinical/encounter-service"
import { buildEncounterVisitJourney } from "@/lib/clinical/clinical-visit-journey"
import { ClinicalVisitJourneyPanel } from "@/components/clinical/ClinicalVisitJourneyPanel"

type CheckItem = {
  id: string
  label: string
  description: string
  done: boolean
  href?: string
  icon: React.ComponentType<{ className?: string }>
}

function buildChecklist(
  patientId: string,
  detail: PatientEncounterDetail,
  hasChartFindings: boolean
): CheckItem[] {
  const queue = detail.queue
  const notes = detail.notes
  const plans = detail.plans
  const invoices = detail.invoices

  const hasSignedNote = notes.some((n) => n.status === "signed")
  const hasApprovedPlan = plans.some((p) =>
    ["approved", "in_progress", "completed"].includes(p.status)
  )
  const invoicePaid =
    invoices.length > 0 &&
    invoices.every((i) => i.status === "paid" || i.paid_amount >= i.total_amount)

  return [
    {
      id: "queue",
      label: "Queue & check-in",
      description: queue
        ? `${queue.display_code} · ${queue.status.replace(/_/g, " ")}${queue.chair_label ? ` · ${queue.chair_label}` : ""}`
        : "No queue record",
      done: Boolean(queue && ["in_chair", "served"].includes(queue.status)),
      href: "/queue",
      icon: UserCheck,
    },
    {
      id: "note",
      label: "Clinical note",
      description: notes[0]
        ? `${notes[0].title} · ${notes[0].status}`
        : "No clinical note for this visit",
      done: hasSignedNote || notes.length > 0,
      href: `/patients/${patientId}?tab=clinical-notes`,
      icon: FileText,
    },
    {
      id: "chart",
      label: "Dental chart",
      description: hasChartFindings ? "Chart findings recorded" : "No chart findings yet",
      done: hasChartFindings,
      href: `/patients/${patientId}/chart`,
      icon: Stethoscope,
    },
    {
      id: "plan",
      label: "Treatment plan",
      description: plans[0]
        ? `${plans[0].title} · ${plans[0].status}`
        : "No plan for this visit",
      done: hasApprovedPlan || plans.length > 0,
      href: `/patients/${patientId}/treatment-plan`,
      icon: ClipboardList,
    },
    {
      id: "billing",
      label: "Invoice & payment",
      description: invoices[0]
        ? `${invoices[0].invoice_number ?? "Invoice"} · ${invoices[0].status}`
        : "No invoice linked",
      done: invoicePaid,
      href: invoices[0] ? `/billing/${invoices[0].id}` : `/billing?patient=${patientId}`,
      icon: Wallet,
    },
  ]
}

function statusBadgeVariant(status: string) {
  if (status === "open") return "info" as const
  if (status === "closed") return "success" as const
  return "outline" as const
}

function statusLabel(status: string, t: (key: string, fallback: string) => string) {
  if (status === "open") return t("visits.statusOpen", "Open")
  if (status === "closed") return t("visits.statusClosed", "Discharged")
  if (status === "cancelled") return t("visits.statusCancelled", "Cancelled")
  return status
}

function EncounterDetailPanel({
  patientId,
  detail,
  hasChartFindings,
  onChanged,
}: {
  patientId: string
  detail: PatientEncounterDetail
  hasChartFindings: boolean
  onChanged: () => void
}) {
  const { t } = useLocale()
  const router = useRouter()
  const [busy, setBusy] = React.useState<"reopen" | "cancel" | null>(null)
  const [actionError, setActionError] = React.useState<string | null>(null)

  const journey = buildEncounterVisitJourney({
    patientId,
    detail,
    hasChartFindings,
  })
  const checklist = buildChecklist(patientId, detail, hasChartFindings)
  const isOpen = detail.encounter.status === "open"
  const isClosed = detail.encounter.status === "closed"
  const hasPaidInvoice = detail.invoices.some(
    (inv) => inv.status === "paid" || inv.paid_amount > 0
  )

  const goCheckout = () => {
    startTransition(() => {
      addTransitionType("nav-forward")
      router.push(`/patients/${patientId}?checkout=1`)
    })
  }

  const handleReopen = async () => {
    const ok = await notify.confirm(
      t(
        "visits.reopenConfirm",
        "Undo discharge and reopen today’s visit? Use this if checkout closed too early."
      ),
      {
        title: t("visits.reopenTitle", "Undo discharge"),
        confirmLabel: t("visits.reopenCta", "Reopen visit"),
      }
    )
    if (!ok) return

    setBusy("reopen")
    setActionError(null)
    const { error } = await reopenPatientEncounter(detail.encounter.id)
    if (error) {
      setActionError(error)
      notify.error(error)
    } else {
      notify.success(
        t("visits.reopened", "Visit reopened — it appears as today’s open visit again.")
      )
      onChanged()
    }
    setBusy(null)
  }

  const handleCancel = async () => {
    const ok = await notify.confirm(
      t(
        "visits.cancelConfirm",
        "Cancel this mistaken visit? The patient leaves the live queue if still waiting or in chair. Paid visits cannot be cancelled."
      ),
      {
        title: t("visits.cancelTitle", "Cancel visit"),
        confirmLabel: t("visits.cancelCta", "Cancel visit"),
      }
    )
    if (!ok) return

    setBusy("cancel")
    setActionError(null)
    const { error } = await cancelPatientEncounter(
      detail.encounter.id,
      "Staff cancelled mistaken visit"
    )
    if (error) {
      setActionError(error)
      notify.error(error)
    } else {
      notify.success(t("visits.cancelled", "Visit cancelled"))
      onChanged()
    }
    setBusy(null)
  }

  return (
    <div className="border-t border-neutral-200 bg-white px-4 py-4 space-y-4 animate-in slide-in-from-top-1 duration-200">
      <ClinicalVisitJourneyPanel
        journey={journey}
        celebrate={journey.percentComplete >= 100 && isOpen}
        finishAction={
          isOpen
            ? {
                label: t("visits.finishVisit", "Checkout / Discharge"),
                onClick: goCheckout,
              }
            : undefined
        }
      />

      <div className="flex flex-wrap gap-2">
        {isOpen ? (
          <Button size="sm" className="gap-2" onClick={goCheckout}>
            <DoorClosed className="h-4 w-4" aria-hidden />
            {t("queue.checkoutDischargeCta", "Checkout / Discharge")}
          </Button>
        ) : null}

        {isClosed ? (
          <PermissionGate
            anyOf={[PERMISSIONS.QUEUE_MANAGE, PERMISSIONS.DENTAL_CHART_WRITE]}
            fallback={null}
          >
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              disabled={busy === "reopen"}
              onClick={() => void handleReopen()}
            >
              {busy === "reopen" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <RotateCcw className="h-4 w-4" aria-hidden />
              )}
              {t("visits.reopenCta", "Undo discharge")}
            </Button>
          </PermissionGate>
        ) : null}

        {isOpen && !hasPaidInvoice ? (
          <PermissionGate permission={PERMISSIONS.QUEUE_MANAGE} fallback={null}>
            <Button
              size="sm"
              variant="ghost"
              className="gap-2 text-red-700 hover:text-red-800 hover:bg-red-50"
              disabled={busy === "cancel"}
              onClick={() => void handleCancel()}
            >
              {busy === "cancel" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <XCircle className="h-4 w-4" aria-hidden />
              )}
              {t("visits.cancelCta", "Cancel mistaken visit")}
            </Button>
          </PermissionGate>
        ) : null}
      </div>

      {actionError ? <p className="text-sm text-red-700">{actionError}</p> : null}

      {isClosed ? (
        <p className="text-xs text-neutral-600">
          {t(
            "visits.reopenHint",
            "Closed by checkout or auto-close after payment. Undo discharge if it happened too early."
          )}
        </p>
      ) : null}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
          {t("visits.visitChecklist", "Visit checklist")}
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {checklist.map((item) => {
            const Icon = item.icon
            return (
              <li
                key={item.id}
                className={cn(
                  "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm",
                  item.done
                    ? "border-emerald-200/80 bg-emerald-50/40"
                    : "border-neutral-200 bg-neutral-50/50"
                )}
              >
                {item.done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-neutral-300 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="font-medium text-primary-700 hover:underline"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <p className="font-medium text-neutral-900">{item.label}</p>
                  )}
                  <p className="text-xs text-neutral-500 mt-0.5">{item.description}</p>
                </div>
                <Icon className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
              </li>
            )
          })}
        </ul>
      </div>

      {detail.notes.length > 0 || detail.plans.length > 0 || detail.invoices.length > 0 ? (
        <div className="rounded-lg border border-neutral-200 divide-y divide-neutral-100 text-sm">
          {detail.notes.map((n) => (
            <div key={n.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="flex items-center gap-2 min-w-0">
                <FileText className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                <span className="truncate">{n.title}</span>
              </span>
              <Badge variant={n.status === "signed" ? "success" : "outline"} className="text-[10px] shrink-0">
                {n.status}
              </Badge>
            </div>
          ))}
          {detail.plans.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="flex items-center gap-2 min-w-0">
                <ClipboardList className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                <span className="truncate">{p.title}</span>
              </span>
              <Badge variant="outline" className="text-[10px] shrink-0 capitalize">
                {p.status.replace(/_/g, " ")}
              </Badge>
            </div>
          ))}
          {detail.invoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <Link href={`/billing/${inv.id}`} className="flex items-center gap-2 min-w-0 text-primary-700 hover:underline">
                <Receipt className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{inv.invoice_number ?? "Invoice"}</span>
              </Link>
              <Badge variant={inv.status === "paid" ? "success" : "outline"} className="text-[10px] shrink-0">
                {inv.status}
              </Badge>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function PatientEncountersWorkspace({
  patientId,
  patientName,
  branchId,
  hasChartFindings = false,
  defaultExpandedId,
}: {
  patientId: string
  patientName?: string
  branchId?: string | null
  hasChartFindings?: boolean
  defaultExpandedId?: string | null
}) {
  const { t, locale } = useLocale()
  const patientArrivalHref = `/queue?${new URLSearchParams({
    walkinPatient: patientId,
    ...(patientName ? { walkinName: patientName } : {}),
  }).toString()}`
  const [encounters, setEncounters] = React.useState<PatientEncounterSummary[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [expandedId, setExpandedId] = React.useState<string | null>(defaultExpandedId ?? null)
  const [details, setDetails] = React.useState<Record<string, PatientEncounterDetail>>({})
  const [loadingDetail, setLoadingDetail] = React.useState<string | null>(null)
  const autoExpandedRef = React.useRef(false)

  const loadDetail = React.useCallback(async (encounterId: string) => {
    setLoadingDetail(encounterId)
    const { data, error: detailError } = await fetchEncounterDetail(encounterId)
    if (detailError) setError(detailError)
    else if (data) setDetails((prev) => ({ ...prev, [encounterId]: data }))
    setLoadingDetail(null)
  }, [])

  const loadList = React.useCallback(async () => {
    setLoading(true)
    const { data, error: listError } = await fetchPatientEncounters(patientId, branchId)
    if (listError) setError(listError)
    else {
      setError(null)
      setEncounters(data)
    }
    setLoading(false)
  }, [patientId, branchId])

  React.useEffect(() => {
    const id = window.setTimeout(() => void loadList(), 0)
    return () => window.clearTimeout(id)
  }, [loadList])

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      if (defaultExpandedId) {
        setExpandedId(defaultExpandedId)
        void loadDetail(defaultExpandedId)
        return
      }
      if (autoExpandedRef.current || encounters.length === 0) return
      const open = encounters.find((e) => e.status === "open")
      if (open) {
        autoExpandedRef.current = true
        setExpandedId(open.id)
        void loadDetail(open.id)
      }
    }, 0)
    return () => window.clearTimeout(id)
  }, [encounters, defaultExpandedId, loadDetail])

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    if (!details[id]) void loadDetail(id)
  }

  const handleChanged = async (id: string) => {
    await loadDetail(id)
    await loadList()
  }

  const openCount = encounters.filter((e) => e.status === "open").length

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary-600" />
              {t("visits.encountersTitle", "Clinic visits")}
            </CardTitle>
            <CardDescription>
              {t(
                "visits.encountersDescription",
                "Each arrival is a separate visit. Tap a row to review queue, notes, chart, plan, and billing for that day."
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {openCount > 0 ? (
              <Badge variant="info">
                {openCount} {t("visits.open", "open")}
              </Badge>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => void loadList()}>
              {t("common.refresh", "Refresh")}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-neutral-500 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("common.loading", "Loading…")}
          </p>
        ) : error ? (
          <p className="text-sm text-red-700">{error}</p>
        ) : encounters.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 px-4 py-8 text-center">
            <UserCheck className="h-8 w-8 mx-auto text-neutral-300 mb-2" />
            <p className="text-sm text-neutral-600">{t("visits.empty", "No visits recorded yet.")}</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-neutral-500">
              {t(
                "visits.emptyArrivalHint",
                "When the patient arrives, open Patient arrival from Queue. Check-in creates the visit and puts them in Waiting."
              )}
            </p>
            <Button variant="outline" size="sm" className="mt-3" asChild>
              <Link href={patientArrivalHref}>{t("visits.checkInCta", "Open patient arrival")}</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {encounters.map((enc) => {
              const isExpanded = expandedId === enc.id
              const detail = details[enc.id]
              const journeyPreview = detail
                ? buildEncounterVisitJourney({ patientId, detail, hasChartFindings })
                : null

              return (
                <div
                  key={enc.id}
                  className={cn(
                    "rounded-xl border overflow-hidden transition-colors",
                    isExpanded ? "border-primary-300/80 ring-1 ring-primary-100" : "border-neutral-200"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleExpand(enc.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50/80 transition-colors"
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        enc.status === "open" ? "bg-primary-50 text-primary-700" : "bg-neutral-100 text-neutral-600"
                      )}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-neutral-900">
                          {formatDate(locale, enc.opened_at)}
                        </p>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {encounterPublicId(enc)}
                        </Badge>
                        <Badge variant={statusBadgeVariant(enc.status)} className="text-[10px]">
                          {statusLabel(enc.status, t)}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {enc.source_type === "appointment"
                            ? t("visits.scheduled", "Scheduled")
                            : t("visits.walkIn", "Walk-in")}
                        </Badge>
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {enc.queue_code ? `Queue ${enc.queue_code}` : ""}
                        {enc.note_count > 0 ? ` · ${enc.note_count} note(s)` : ""}
                        {enc.plan_count > 0 ? ` · ${enc.plan_count} plan(s)` : ""}
                        {enc.invoice_count > 0 ? ` · ${enc.invoice_count} invoice(s)` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {journeyPreview ? (
                        <p className="text-lg font-bold tabular-nums text-primary-700">
                          {journeyPreview.percentComplete}%
                        </p>
                      ) : enc.status === "closed" ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 ml-auto" />
                      ) : (
                        <CircleDot className="h-5 w-5 text-primary-500 ml-auto" />
                      )}
                    </div>
                  </button>

                  {isExpanded ? (
                    loadingDetail === enc.id && !detail ? (
                      <div className="border-t px-4 py-6 flex justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
                      </div>
                    ) : detail ? (
                      <EncounterDetailPanel
                        patientId={patientId}
                        detail={detail}
                        hasChartFindings={hasChartFindings}
                        onChanged={() => void handleChanged(enc.id)}
                      />
                    ) : null
                  ) : null}
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/patients/${patientId}?tab=appointments`}>
              {t("visits.allAppointments", "All appointments")}
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/lab-cases">
              <FlaskConical className="h-3.5 w-3.5 mr-1" />
              {t("visits.labCases", "Lab cases")}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
