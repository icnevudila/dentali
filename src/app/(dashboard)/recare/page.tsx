"use client"

import * as React from "react"
import Link from "next/link"
import { CalendarHeart, CalendarPlus, ListPlus, Moon, RefreshCw, Settings2, Undo2 } from "lucide-react"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { usePermission } from "@/hooks/use-permission"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DirectionalTransition } from "@/components/layout/DirectionalTransition"
import {
  DEFAULT_RECARE_INTERVAL_MONTHS,
  RECARE_SNOOZE_DAY_OPTIONS,
  fetchRecareDueList,
  recarePatientDisplayName,
  recareWaitlistHref,
  snoozeRecarePatient,
  unsnoozeRecarePatient,
  type RecareDueList,
  type RecareDuePatient,
} from "@/lib/recare/recare-service"

function formatClinicDate(isoDate: string, locale: string): string {
  if (!isoDate) return "—"
  const parsed = new Date(`${isoDate}T12:00:00+08:00`)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return parsed.toLocaleDateString(locale === "fil" ? "fil-PH" : locale === "tr" ? "tr-TR" : "en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

type UndoState = {
  patientId: string
  displayName: string
  days: number
  snoozedUntil: string
  row: RecareDuePatient
}

/**
 * Hygiene / recare worklist home.
 * Due patients come from last visit + clinic recall interval
 * (workflow setting hygiene_recall_months, default 6 months).
 * Snooze hides a row for N days (appointments.write + audit).
 */
export default function RecarePage() {
  const { t, locale } = useLocale()
  const { activeBranch } = useBranch()
  const { hasPermission, loading: permissionLoading } = usePermission()
  const canSnooze = !permissionLoading && hasPermission(PERMISSIONS.APPOINTMENTS_WRITE)

  const [list, setList] = React.useState<RecareDueList | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [snoozingId, setSnoozingId] = React.useState<string | null>(null)
  const [undo, setUndo] = React.useState<UndoState | null>(null)
  const [undoBusy, setUndoBusy] = React.useState(false)
  const [actionError, setActionError] = React.useState<string | null>(null)

  const load = React.useCallback(() => {
    if (!activeBranch) {
      setList(null)
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    void fetchRecareDueList(activeBranch.id).then(({ data, error: err }) => {
      setList(data)
      setError(err)
      setLoading(false)
    })
  }, [activeBranch])

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      load()
    }, 0)
    return () => window.clearTimeout(id)
  }, [load])

  React.useEffect(() => {
    setUndo(null)
    setActionError(null)
  }, [activeBranch?.id])

  const intervalMonths = list?.interval_months ?? DEFAULT_RECARE_INTERVAL_MONTHS
  const rows = list?.rows ?? []
  const usesClinicDefault = intervalMonths === DEFAULT_RECARE_INTERVAL_MONTHS

  async function handleSnooze(row: RecareDuePatient, days: number) {
    if (!activeBranch || !canSnooze || snoozingId) return
    setActionError(null)
    setSnoozingId(row.patient_id)
    const { data, error: err } = await snoozeRecarePatient(activeBranch.id, row.patient_id, days)
    setSnoozingId(null)
    if (err || !data) {
      setActionError(err ?? t("recare.snoozeError", "Could not snooze this patient"))
      return
    }
    const displayName = recarePatientDisplayName(row)
    setList((prev) =>
      prev
        ? {
            ...prev,
            rows: prev.rows.filter((r) => r.patient_id !== row.patient_id),
          }
        : prev
    )
    setUndo({
      patientId: row.patient_id,
      displayName,
      days: data.days,
      snoozedUntil: data.snoozed_until,
      row,
    })
  }

  async function handleUndo() {
    if (!activeBranch || !undo || undoBusy) return
    setUndoBusy(true)
    setActionError(null)
    const { error: err } = await unsnoozeRecarePatient(activeBranch.id, undo.patientId)
    setUndoBusy(false)
    if (err) {
      setActionError(err)
      return
    }
    const restored = undo.row
    setUndo(null)
    setList((prev) => {
      if (!prev) return prev
      if (prev.rows.some((r) => r.patient_id === restored.patient_id)) return prev
      return {
        ...prev,
        rows: [...prev.rows, restored].toSorted(
          (a, b) => a.last_visit_date.localeCompare(b.last_visit_date)
        ),
      }
    })
  }

  return (
    <PermissionGate permission={PERMISSIONS.APPOINTMENTS_READ}>
      <DirectionalTransition>
        <ModulePageShell
          eyebrow={t("recare.eyebrow", "Front desk")}
          icon={CalendarHeart}
          title={t("nav.recare", "Recare")}
          compactHeader
          description={t(
            "recare.description",
            "Patients due for hygiene or recall visits. Book or park on the waitlist from one worklist."
          )}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="tabular-nums">
                {t("recare.intervalBadge", "{months}-month recall").replace(
                  "{months}",
                  String(intervalMonths)
                )}
              </Badge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => load()}
                disabled={!activeBranch || loading}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                {t("common.refresh", "Refresh")}
              </Button>
              <Button asChild variant="outline" size="sm" className="gap-2">
                <Link href="/settings/workflow">
                  <Settings2 className="h-4 w-4" aria-hidden />
                  {t("recare.openWorkflow", "Hygiene recall settings")}
                </Link>
              </Button>
            </div>
          }
        >
          {!activeBranch ? (
            <p className="text-sm text-neutral-500">
              {t("dashboard.selectBranch", "Select a branch to view stats")}
            </p>
          ) : loading ? (
            <PageLoadingSkeleton variant="listRows" />
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50/80 p-4">
              <p className="text-sm font-medium text-red-800">
                {t("recare.errorTitle", "Could not load recall worklist")}
              </p>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => load()}>
                {t("common.retry", "Retry")}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {actionError ? (
                <div className="rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-sm text-red-800">
                  {actionError}
                </div>
              ) : null}
              {undo ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                  <p>
                    {t("recare.snoozedToast", "Snoozed {name} for {days} days (until {date})")
                      .replace("{name}", undo.displayName)
                      .replace("{days}", String(undo.days))
                      .replace("{date}", formatClinicDate(undo.snoozedUntil, locale))}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={undoBusy || !canSnooze}
                    onClick={() => void handleUndo()}
                  >
                    <Undo2 className="h-3.5 w-3.5" aria-hidden />
                    {undoBusy
                      ? t("common.saving", "Saving…")
                      : t("recare.undoSnooze", "Undo snooze")}
                  </Button>
                </div>
              ) : null}

              {rows.length === 0 ? (
                <EmptyState
                  icon={CalendarHeart}
                  title={
                    list?.has_visit_history
                      ? t("recare.emptyTitle", "No recall patients yet")
                      : t("recare.noDataTitle", "Not enough recall data yet")
                  }
                  description={
                    list?.has_visit_history
                      ? t(
                          "recare.emptyDescription",
                          "Nobody is due for a {months}-month recall right now, or due patients already have a future booking. Book from appointments or park them on the waitlist."
                        ).replace("{months}", String(intervalMonths))
                      : t(
                          "recare.noDataDescription",
                          "Recall due dates use each patient's last visit at this branch. After visits are recorded, patients overdue for the {months}-month interval will appear here."
                        ).replace("{months}", String(intervalMonths))
                  }
                  action={
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Button asChild size="sm">
                        <Link href="/appointments">
                          {t("recare.openAppointments", "Open appointments")}
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link href="/waitlist">{t("recare.openWaitlist", "Open waitlist")}</Link>
                      </Button>
                    </div>
                  }
                />
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-600">
                    <p>
                      {t("recare.dueCount", "{count} due").replace("{count}", String(rows.length))}
                      {list?.as_of_date
                        ? ` · ${t("recare.asOf", "As of {date}").replace(
                            "{date}",
                            formatClinicDate(list.as_of_date, locale)
                          )}`
                        : null}
                    </p>
                    <p className="text-neutral-500">
                      {usesClinicDefault
                        ? t(
                            "recare.intervalHintDefault",
                            "Based on last visit + clinic default {months}-month hygiene recall (Settings → Workflow)."
                          ).replace("{months}", String(intervalMonths))
                        : t(
                            "recare.intervalHintConfigured",
                            "Based on last visit + {months}-month interval from Settings → Workflow."
                          ).replace("{months}", String(intervalMonths))}
                    </p>
                  </div>
                  <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
                    {rows.map((row) => {
                      const name = recarePatientDisplayName(row)
                      const bookHref = `/appointments?patient=${row.patient_id}&patientName=${encodeURIComponent(name)}`
                      const waitlistHref = recareWaitlistHref(row.patient_id, name)
                      const rowBusy = snoozingId === row.patient_id
                      return (
                        <li
                          key={row.patient_id}
                          className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0 space-y-1">
                            <Link
                              href={`/patients/${row.patient_id}`}
                              className="truncate text-sm font-medium text-neutral-900 hover:underline"
                            >
                              {name}
                            </Link>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
                              <span>
                                {t("recare.lastVisit", "Last visit")}:{" "}
                                {formatClinicDate(row.last_visit_date, locale)}
                              </span>
                              <span>
                                {t("recare.dueDate", "Due")}: {formatClinicDate(row.due_date, locale)}
                              </span>
                              {row.days_overdue > 0 ? (
                                <Badge variant="warning" className="tabular-nums">
                                  {t("recare.daysOverdue", "{days}d overdue").replace(
                                    "{days}",
                                    String(row.days_overdue)
                                  )}
                                </Badge>
                              ) : (
                                <Badge variant="info">{t("recare.dueToday", "Due today")}</Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button asChild size="sm" className="gap-1.5">
                              <Link href={bookHref}>
                                <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
                                {t("recare.bookAppointment", "Book appointment")}
                              </Link>
                            </Button>
                            <Button asChild variant="outline" size="sm" className="gap-1.5">
                              <Link href={waitlistHref}>
                                <ListPlus className="h-3.5 w-3.5" aria-hidden />
                                {t("recare.addWaitlist", "Waitlist")}
                              </Link>
                            </Button>
                            {canSnooze ? (
                              <div className="flex flex-wrap items-center gap-1">
                                <span className="inline-flex items-center gap-1 px-1 text-xs text-neutral-500">
                                  <Moon className="h-3.5 w-3.5" aria-hidden />
                                  {t("recare.snooze", "Snooze")}
                                </span>
                                {RECARE_SNOOZE_DAY_OPTIONS.map((days) => (
                                  <Button
                                    key={days}
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 tabular-nums"
                                    disabled={Boolean(snoozingId)}
                                    aria-label={t("recare.snoozeDaysAria", "Snooze for {days} days").replace(
                                      "{days}",
                                      String(days)
                                    )}
                                    onClick={() => void handleSnooze(row, days)}
                                  >
                                    {rowBusy
                                      ? "…"
                                      : t("recare.snoozeDays", "{days}d").replace("{days}", String(days))}
                                  </Button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </div>
          )}
        </ModulePageShell>
      </DirectionalTransition>
    </PermissionGate>
  )
}
