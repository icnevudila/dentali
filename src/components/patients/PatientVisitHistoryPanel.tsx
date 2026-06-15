"use client"

import * as React from "react"
import Link from "next/link"
import { Calendar, ClipboardList, FileText, FlaskConical, UserCheck } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/use-locale"
import { formatDate } from "@/lib/i18n/translate"
import type { AppLocale } from "@/lib/i18n/config"
import { fetchPatientTimeline } from "@/lib/clinical/clinical-notes-service"
import { fetchPatientQueueHistory } from "@/lib/queue/queue-service"
import { fetchPatientLabCases } from "@/lib/clinical/lab-service"
import {
  groupSessionsByWeek,
  groupVisitRowsIntoSessions,
  mergeVisitRows,
  type VisitRow,
  type VisitWeekBucket,
} from "@/lib/patients/visit-history-grouping"

function kindIcon(kind: VisitRow["kind"]) {
  switch (kind) {
    case "clinical_note":
      return FileText
    case "queue_visit":
      return UserCheck
    case "lab_case":
      return FlaskConical
    default:
      return Calendar
  }
}

function kindBadge(row: VisitRow, t: (key: string, fallback: string) => string) {
  if (row.kind === "lab_case") {
    return (
      <Badge variant="outline" className="text-[10px]">
        {t("visits.labCase", "Lab")}
      </Badge>
    )
  }
  if (row.meta === "online") {
    return (
      <Badge variant="info" className="text-[10px]">
        {t("visits.onlineBooking", "Online")}
      </Badge>
    )
  }
  if (row.meta === "scheduled") {
    return (
      <Badge variant="info" className="text-[10px]">
        {t("visits.scheduled", "Scheduled")}
      </Badge>
    )
  }
  if (row.meta === "walk-in") {
    return (
      <Badge variant="outline" className="text-[10px]">
        {t("visits.walkIn", "Walk-in")}
      </Badge>
    )
  }
  if (row.kind === "clinical_note") {
    return (
      <Badge variant="outline" className="text-[10px]">
        {t("visits.clinicalNote", "Note")}
      </Badge>
    )
  }
  return null
}

function weekBucketLabel(bucket: VisitWeekBucket, t: (key: string, fallback: string) => string) {
  switch (bucket) {
    case "this_week":
      return t("visits.thisWeek", "This week")
    case "last_week":
      return t("visits.lastWeek", "Last week")
    default:
      return t("visits.earlier", "Earlier")
  }
}

function sessionTitle(sessionAt: string, t: (key: string, fallback: string) => string, locale: AppLocale) {
  return t("visits.sessionOn", "Visit · {date}").replace(
    "{date}",
    formatDate(locale, sessionAt)
  )
}

export function PatientVisitHistoryPanel({ patientId, branchId }: { patientId: string; branchId?: string | null }) {
  const { t, locale } = useLocale()
  const [grouped, setGrouped] = React.useState<ReturnType<typeof groupSessionsByWeek>>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    const [timelineRes, queueRes, labRes] = await Promise.all([
      fetchPatientTimeline(patientId),
      fetchPatientQueueHistory(patientId, branchId),
      fetchPatientLabCases(patientId, branchId),
    ])
    if (timelineRes.error) setError(timelineRes.error)
    else setError(null)

    const rows = mergeVisitRows(timelineRes.data, queueRes.data, labRes.data)
    const sessions = groupVisitRowsIntoSessions(rows, queueRes.data)
    setGrouped(groupSessionsByWeek(sessions))
    setLoading(false)
  }, [patientId, branchId])

  React.useEffect(() => {
    void load()
  }, [load])

  const sessionCount = grouped.reduce((sum, g) => sum + g.sessions.length, 0)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary-600" />
              {t("visits.title", "Visit history")}
            </CardTitle>
            <CardDescription>
              {t(
                "visits.descriptionGrouped",
                "Each clinic visit is grouped separately — check-ins, appointments, notes, and lab work from the same day stay together."
              )}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            {t("common.refresh", "Refresh")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-neutral-500">{t("common.loading", "Loading…")}</p>
        ) : error ? (
          <p className="text-sm text-red-700">{error}</p>
        ) : sessionCount === 0 ? (
          <p className="text-sm text-neutral-500">{t("visits.empty", "No visits recorded yet.")}</p>
        ) : (
          <div className="space-y-6">
            {grouped.map((group) => (
              <section key={group.bucket}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">
                  {weekBucketLabel(group.bucket, t)}
                </h3>
                <div className="space-y-4">
                  {group.sessions.map((session) => (
                    <div
                      key={session.key}
                      className="rounded-xl border border-neutral-200 bg-neutral-50/40 overflow-hidden"
                    >
                      <div className="border-b border-neutral-200 bg-white px-4 py-2.5">
                        <p className="text-sm font-semibold text-neutral-900">
                          {sessionTitle(session.sessionAt, t, locale)}
                        </p>
                      </div>
                      <ul className="divide-y divide-neutral-100 px-4">
                        {session.rows.map((row) => {
                          const Icon = kindIcon(row.kind)
                          return (
                            <li key={row.id} className="flex gap-3 py-3 first:pt-3 last:pb-3">
                              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-neutral-600 ring-1 ring-neutral-200/80">
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-medium text-neutral-900">{row.title}</p>
                                  {kindBadge(row, t)}
                                  <Badge
                                    variant={
                                      row.status === "completed" ||
                                      row.status === "served" ||
                                      row.status === "signed"
                                        ? "success"
                                        : "outline"
                                    }
                                    className="text-[10px] capitalize"
                                  >
                                    {row.status.replace(/_/g, " ")}
                                  </Badge>
                                </div>
                                <p className="text-xs text-neutral-500 mt-0.5">
                                  {formatDate(locale, row.occurredAt)}
                                  {row.subtitle ? ` · ${row.subtitle}` : ""}
                                </p>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/patients/${patientId}?tab=appointments`}>
              {t("visits.allAppointments", "All appointments")}
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/patients/${patientId}?tab=clinical-notes`}>
              {t("visits.allNotes", "Clinical notes")}
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/lab-cases">{t("visits.labCases", "Lab cases")}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
