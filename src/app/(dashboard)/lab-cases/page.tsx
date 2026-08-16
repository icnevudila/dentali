"use client"

import * as React from "react"
import Link from "next/link"
import { useLocale } from "@/hooks/use-locale"
import { useBranch } from "@/hooks/use-branch"
import {
  fetchActiveLabCases,
  LAB_CASE_STATUS_FLOW,
  updateLabCaseStatus,
  type LabCaseStatus,
  type PatientWithLabCase,
} from "@/lib/clinical/lab-service"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { PageHeader } from "@/components/layout/PageHeader"
import { SectionEyebrow } from "@/components/layout/SectionEyebrow"
import { DirectionalTransition } from "@/components/layout/DirectionalTransition"
import { StickyActionBar } from "@/components/layout/StickyActionBar"
import { MetricStrip } from "@/components/layout/MetricStrip"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { FlaskConical, Plus, CheckCircle2, Clock, XCircle, AlertCircle, RefreshCw } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { NewLabCaseDialog } from "@/components/clinical/lab/NewLabCaseDialog"
import { formatCurrency } from "@/lib/i18n/translate"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const TODAY_KEY = new Date().toISOString().slice(0, 10)

function labCaseUrgency(c: PatientWithLabCase) {
  if (c.status === "completed" || c.status === "received") return "received"
  if (
    ["pending", "sent", "try_in", "remake"].includes(c.status) &&
    c.expected_date &&
    c.next_appointment_date &&
    c.expected_date > c.next_appointment_date
  ) {
    return "conflict"
  }
  if (
    ["pending", "sent", "try_in", "remake"].includes(c.status) &&
    c.expected_date &&
    c.expected_date < TODAY_KEY
  ) {
    return "overdue"
  }
  if (
    ["pending", "sent", "try_in", "remake"].includes(c.status) &&
    c.expected_date &&
    c.expected_date <= TODAY_KEY
  ) {
    return "due_today"
  }
  return "pending"
}

const STATUS_LABEL: Record<LabCaseStatus, string> = {
  pending: "Pending",
  sent: "Sent to lab",
  try_in: "Try-in",
  remake: "Remake",
  received: "Received",
  completed: "Completed",
  cancelled: "Cancelled",
}

const NEXT_STATUS: Partial<Record<LabCaseStatus, LabCaseStatus>> = {
  pending: "sent",
  sent: "try_in",
  try_in: "received",
  remake: "sent",
  received: "completed",
}

export default function LabCasesPage() {
  const { t, locale } = useLocale()
  const { activeBranch } = useBranch()
  const [cases, setCases] = React.useState<PatientWithLabCase[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)

  const loadCases = React.useCallback(async () => {
    if (!activeBranch?.id) {
      setCases([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: loadError } = await fetchActiveLabCases(activeBranch.id)
    if (loadError) {
      setError(loadError)
      toast.error(loadError)
    }
    setCases(data)
    setLoading(false)
  }, [activeBranch])

  const handleLabCaseCreated = React.useCallback(
    async (created?: PatientWithLabCase) => {
      if (created) {
        setCases((prev) => {
          const exists = prev.some((c) => c.id === created.id)
          if (exists) return prev
          return [created, ...prev]
        })
        setError(null)
        setLoading(false)
      }
      await loadCases()
    },
    [loadCases]
  )

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      void loadCases()
    }, 0)
    return () => window.clearTimeout(id)
  }, [loadCases])

  const caseStats = React.useMemo(() => {
    const inFlight = cases.filter((c) =>
      ["pending", "sent", "try_in", "remake"].includes(c.status)
    )
    return {
      pending: inFlight.length,
      overdue: inFlight.filter((c) => labCaseUrgency(c) === "overdue").length,
      dueToday: inFlight.filter((c) => labCaseUrgency(c) === "due_today").length,
      received: cases.filter((c) => c.status === "received" || c.status === "completed").length,
    }
  }, [cases])

  const sortedCases = React.useMemo(
    () =>
      [...cases].sort((a, b) => {
        const rank = { overdue: 0, due_today: 1, pending: 2, received: 3 } as Record<string, number>
        const urgencyDiff = rank[labCaseUrgency(a)] - rank[labCaseUrgency(b)]
        if (urgencyDiff !== 0) return urgencyDiff
        return (a.expected_date ?? "9999-12-31").localeCompare(b.expected_date ?? "9999-12-31")
      }),
    [cases]
  )

  const overdueCases = React.useMemo(
    () =>
      sortedCases.filter(
        (c) =>
          ["pending", "sent", "try_in", "remake"].includes(c.status) &&
          labCaseUrgency(c) === "overdue"
      ),
    [sortedCases]
  )

  const handleStatus = async (id: string, status: LabCaseStatus) => {
    const { error: statusError } = await updateLabCaseStatus(id, status)
    if (statusError) {
      toast.error(statusError)
      return
    }
    toast.success(
      t("labcases.statusUpdated", "Lab case updated to {status}.").replace(
        "{status}",
        STATUS_LABEL[status]
      )
    )
    void loadCases()
  }

  const handleCancel = async (id: string) => {
    const { error: cancelError } = await updateLabCaseStatus(id, "cancelled")
    if (cancelError) toast.error(cancelError)
    else void loadCases()
  }

  const canCreate = Boolean(activeBranch?.id)
  const listIsEmpty = Boolean(activeBranch?.id) && !loading && !error && cases.length === 0
  const showHeaderCreate = canCreate && !listIsEmpty

  return (
    <PermissionGate permission={PERMISSIONS.PATIENTS_READ}>
    <DirectionalTransition className="mx-auto w-full max-w-7xl">
      <ContentPanel padding="lg" className="space-y-6">
        <SectionEyebrow icon={FlaskConical}>
          {t("labcases.eyebrow", "Clinical")} · {t("labcases.module", "Lab Cases")}
        </SectionEyebrow>

        <PageHeader
          compact
          title={t("labcases.title", "Laboratory Cases")}
          description={t("labcases.description", "Track impressions, crowns, and external lab orders.")}
          actions={
            showHeaderCreate ? (
            <Button
              size="sm"
              className="hidden gap-2 md:inline-flex"
              onClick={() => setDialogOpen(true)}
              disabled={!canCreate}
            >
              <Plus className="h-4 w-4" />
              {t("labcases.new", "New Lab Case")}
            </Button>
            ) : null
          }
        />

        <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-4 sm:p-5">
          <MetricStrip
            items={[
              {
                label: t("labcases.overdue", "Overdue"),
                value: loading ? "—" : caseStats.overdue,
                variant: caseStats.overdue > 0 ? ("warning" as const) : undefined,
              },
              {
                label: t("labcases.dueToday", "Due today"),
                value: loading ? "—" : caseStats.dueToday,
                variant: caseStats.dueToday > 0 ? ("warning" as const) : undefined,
              },
              {
                label: t("labcases.pending", "Pending"),
                value: loading ? "—" : caseStats.pending,
              },
              {
                label: t("labcases.received", "Received"),
                value: loading ? "—" : caseStats.received,
                variant: caseStats.received > 0 ? ("success" as const) : undefined,
              },
            ]}
            className="lg:grid-cols-4"
          />
        </div>

        {overdueCases.length > 0 && !error ? (
          <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 text-sm text-red-950 flex items-start gap-3 shadow-sm animate-fade-in">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-red-900">{t("labcases.delayedAlertTitle", "Delayed Lab Work Alert")}</p>
              <p className="mt-0.5 text-xs text-red-800/80">
                {t("labcases.delayedAlertHint", "{count} lab cases are past their expected delivery date. Follow up with labs immediately to prevent patient appointment delays.").replace("{count}", String(overdueCases.length))}
              </p>
              <ul className="mt-3 space-y-1.5 divide-y divide-red-100/20">
                {overdueCases.slice(0, 3).map((c) => (
                  <li key={c.id} className="pt-1.5 first:pt-0 text-xs flex flex-wrap justify-between items-center gap-2">
                    <span className="font-medium text-red-950">{c.patients?.first_name} {c.patients?.last_name} ({c.case_type})</span>
                    <span className="text-[11px] text-red-700 bg-red-100/60 px-2 py-0.5 rounded font-medium">
                      {c.lab_name} · Expected: {c.expected_date}
                    </span>
                  </li>
                ))}
                {overdueCases.length > 3 && (
                  <li className="pt-2 text-[11px] text-red-700/80 italic font-medium">
                    + {overdueCases.length - 3} more delayed case(s)...
                  </li>
                )}
              </ul>
            </div>
          </div>
        ) : null}

        {listIsEmpty ? null : (
        <StickyActionBar>
          <Button
            className="h-11 w-full gap-2"
            onClick={() => setDialogOpen(true)}
            disabled={!canCreate}
          >
            <Plus className="h-4 w-4 shrink-0" />
            {t("labcases.new", "New Lab Case")}
          </Button>
        </StickyActionBar>
        )}

        {!activeBranch?.id ? (
          <EmptyState
            icon={FlaskConical}
            title={t("labcases.noBranchTitle", "Select a branch")}
            description={t(
              "labcases.noBranchHint",
              "Choose an active clinic branch to track lab cases for that location."
            )}
            action={
              <Button asChild size="sm" variant="outline">
                <Link href="/settings/branches">{t("labcases.manageBranches", "Manage branches")}</Link>
              </Button>
            }
          />
        ) : loading ? (
          <PageLoadingSkeleton variant="list" />
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50/80 p-4">
            <p className="text-sm font-medium text-red-800">
              {t("labcases.loadErrorTitle", "Could not load lab cases")}
            </p>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 gap-1.5"
              onClick={() => void loadCases()}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              {t("common.retry", "Retry")}
            </Button>
          </div>
        ) : cases.length === 0 ? (
          <EmptyState
            icon={FlaskConical}
            title={t("labcases.emptyTitle", "No active lab cases")}
            description={t(
              "labcases.emptyHint",
              "When you send an impression to an external lab, track it here."
            )}
            action={
              <Button size="sm" className="gap-2" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden />
                {t("labcases.new", "New Lab Case")}
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedCases.map((c) => {
              const urgency = labCaseUrgency(c)
              return (
              <Card
                key={c.id}
                className={
                  urgency === "conflict"
                    ? "border-red-300 bg-red-50/20 ring-1 ring-red-400/20"
                    : urgency === "overdue"
                      ? "border-red-200 bg-red-50/30"
                      : urgency === "due_today"
                        ? "border-amber-200 bg-amber-50/30"
                        : c.status === "received"
                          ? "border-emerald-200 bg-emerald-50/30"
                          : ""
                }
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <Link href={`/patients/${c.patient_id}`} className="font-semibold text-neutral-900 hover:text-primary-700 hover:underline">
                        {c.patients?.first_name} {c.patients?.last_name}
                      </Link>
                      <p className="text-xs text-neutral-500">{c.case_type}</p>
                    </div>
                    {urgency === "conflict" ? (
                      <Badge variant="outline" className="text-red-700 bg-red-100 border-red-300 animate-pulse">
                        <AlertCircle className="w-3 h-3 mr-1" /> Appointment Conflict
                      </Badge>
                    ) : urgency === "overdue" ? (
                      <Badge variant="outline" className="text-red-700 bg-red-50 border-red-200">
                        <Clock className="w-3 h-3 mr-1" /> {t("labcases.overdue", "Overdue")}
                      </Badge>
                    ) : urgency === "due_today" ? (
                      <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200">
                        <Clock className="w-3 h-3 mr-1" /> {t("labcases.dueToday", "Due today")}
                      </Badge>
                    ) : c.status === "completed" || c.status === "received" ? (
                      <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 mr-1" />{" "}
                        {t(`labcases.status.${c.status}`, STATUS_LABEL[c.status])}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200">
                        <Clock className="w-3 h-3 mr-1" />{" "}
                        {t(`labcases.status.${c.status}`, STATUS_LABEL[c.status])}
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-neutral-50 rounded-md p-2 border">
                    <div>
                      <p className="text-neutral-400 font-medium">{t("labcases.lab", "Lab")}</p>
                      <p className="text-neutral-700 truncate">{c.lab_name}</p>
                    </div>
                    <div>
                      <p className="text-neutral-400 font-medium">{t("labcases.cost", "Cost")}</p>
                      <p className="text-neutral-700">{formatCurrency(locale, c.cost)}</p>
                    </div>
                    <div>
                      <p className="text-neutral-400 font-medium">{t("labcases.sent", "Sent")}</p>
                      <p className="text-neutral-700">{c.sent_date}</p>
                    </div>
                    <div>
                      <p className="text-neutral-400 font-medium">{t("labcases.expected", "Expected")}</p>
                      <p className="text-neutral-700">{c.expected_date || t("labcases.tbd", "TBD")}</p>
                      {c.next_appointment_date && (
                        <p className={cn(
                          "text-[10px] mt-0.5 font-medium",
                          urgency === "conflict" ? "text-red-600 font-bold" : "text-neutral-400"
                        )}>
                          Appt: {c.next_appointment_date}
                        </p>
                      )}
                    </div>
                  </div>

                  {c.notes && (
                    <p className="text-xs text-neutral-500 bg-white p-2 rounded border border-dashed">
                      <span className="font-medium text-neutral-700">{t("labcases.notes", "Notes")}: </span>{c.notes}
                    </p>
                  )}

                  {c.status !== "cancelled" && c.status !== "completed" && (
                    <div className="flex flex-wrap justify-end gap-2 pt-2 border-t mt-2">
                      <Button variant="outline" size="sm" className="h-8" asChild>
                        <Link href={`/patients/${c.patient_id}`}>{t("labcases.patient", "Patient")}</Link>
                      </Button>
                      <select
                        className="h-8 rounded-md border border-neutral-200 bg-white px-2 text-xs font-medium"
                        value={c.status}
                        onChange={(e) => void handleStatus(c.id, e.target.value as LabCaseStatus)}
                        aria-label={t("labcases.changeStatus", "Change status")}
                      >
                        {LAB_CASE_STATUS_FLOW.filter((s) => s !== "cancelled").map((s) => (
                          <option key={s} value={s}>
                            {t(`labcases.status.${s}`, STATUS_LABEL[s])}
                          </option>
                        ))}
                      </select>
                      {c.status !== "received" && NEXT_STATUS[c.status] ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-8"
                          onClick={() => void handleStatus(c.id, NEXT_STATUS[c.status]!)}
                        >
                          {t("labcases.advance", "Advance")} →{" "}
                          {STATUS_LABEL[NEXT_STATUS[c.status]!]}
                        </Button>
                      ) : null}
                      {c.status === "try_in" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => void handleStatus(c.id, "remake")}
                        >
                          {t("labcases.remake", "Remake")}
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => void handleCancel(c.id)}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" /> {t("labcases.cancel", "Cancel")}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )})}
          </div>
        )}

      </ContentPanel>

      <NewLabCaseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleLabCaseCreated}
      />
    </DirectionalTransition>
    </PermissionGate>
  )
}
