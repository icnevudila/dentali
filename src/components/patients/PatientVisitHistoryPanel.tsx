"use client"

import * as React from "react"
import Link from "next/link"
import { Calendar, ClipboardList, FileText, FlaskConical, UserCheck } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/use-locale"
import { formatDate } from "@/lib/i18n/translate"
import { fetchPatientTimeline, type TimelineEvent } from "@/lib/clinical/clinical-notes-service"
import { fetchPatientQueueHistory, type PatientQueueVisit } from "@/lib/queue/queue-service"
import { fetchPatientLabCases, type PatientWithLabCase } from "@/lib/clinical/lab-service"

type VisitRow = {
  id: string
  occurredAt: string
  kind: "appointment" | "clinical_note" | "queue_visit" | "lab_case"
  title: string
  subtitle: string | null
  status: string
  meta?: string
}

function mergeVisitRows(
  timeline: TimelineEvent[],
  queueVisits: PatientQueueVisit[],
  labCases: PatientWithLabCase[]
): VisitRow[] {
  const rows: VisitRow[] = []

  for (const e of timeline) {
    if (e.event_type === "appointment" && e.status === "cancelled") continue
    rows.push({
      id: `${e.event_type}-${e.event_id}`,
      occurredAt: e.occurred_at,
      kind: e.event_type === "clinical_note" ? "clinical_note" : "appointment",
      title: e.title,
      subtitle: e.subtitle,
      status: e.status,
      meta:
        e.event_type === "appointment" && String(e.title).toLowerCase().includes("portal")
          ? "online"
          : undefined,
    })
  }

  for (const q of queueVisits) {
    rows.push({
      id: `queue-${q.id}`,
      occurredAt: q.completed_at ?? q.checked_in_at,
      kind: "queue_visit",
      title: q.appointment_id ? "Scheduled visit" : "Walk-in visit",
      subtitle: `Queue ${q.display_code}${q.chair_label ? ` · ${q.chair_label}` : ""}`,
      status: q.status,
      meta: q.appointment_id ? "scheduled" : "walk-in",
    })
  }

  for (const lab of labCases) {
    rows.push({
      id: `lab-${lab.id}`,
      occurredAt: lab.sent_date,
      kind: "lab_case",
      title: lab.case_type,
      subtitle: lab.lab_name,
      status: lab.status,
    })
  }

  return rows.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  )
}

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

export function PatientVisitHistoryPanel({ patientId, branchId }: { patientId: string; branchId?: string | null }) {
  const { t, locale } = useLocale()
  const [rows, setRows] = React.useState<VisitRow[]>([])
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
    setRows(mergeVisitRows(timelineRes.data, queueRes.data, labRes.data))
    setLoading(false)
  }, [patientId, branchId])

  React.useEffect(() => {
    void load()
  }, [load])

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
                "visits.description",
                "Every time this patient came in — appointments, queue check-ins, notes, and lab work."
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
        ) : rows.length === 0 ? (
          <p className="text-sm text-neutral-500">{t("visits.empty", "No visits recorded yet.")}</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {rows.slice(0, 25).map((row) => {
              const Icon = kindIcon(row.kind)
              return (
                <li key={row.id} className="flex gap-3 py-3 first:pt-0">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-neutral-900">{row.title}</p>
                      {kindBadge(row, t)}
                      <Badge variant={row.status === "completed" || row.status === "served" || row.status === "signed" ? "success" : "outline"} className="text-[10px] capitalize">
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
