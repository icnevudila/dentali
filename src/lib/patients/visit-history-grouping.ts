import type { TimelineEvent } from "@/lib/clinical/clinical-notes-service"
import type { PatientWithLabCase } from "@/lib/clinical/lab-service"
import type { PatientQueueVisit } from "@/lib/queue/queue-service"

export type VisitRow = {
  id: string
  occurredAt: string
  kind: "appointment" | "clinical_note" | "queue_visit" | "lab_case"
  title: string
  subtitle: string | null
  status: string
  meta?: string
}

export type VisitSession = {
  key: string
  sessionAt: string
  sessionDateKey: string
  rows: VisitRow[]
}

export type VisitWeekBucket = "this_week" | "last_week" | "earlier"

export type GroupedVisitHistory = {
  bucket: VisitWeekBucket
  sessions: VisitSession[]
}[]

const MANILA_TZ = "Asia/Manila"

export function manilaDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: MANILA_TZ }).format(new Date(iso))
}

function parseManilaDateKey(key: string): Date {
  return new Date(`${key}T12:00:00+08:00`)
}

function startOfWeekMonday(date: Date): Date {
  const copy = new Date(date)
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + diff)
  return copy
}

export function getVisitWeekBucket(dateKey: string, now = new Date()): VisitWeekBucket {
  const todayKey = manilaDateKey(now.toISOString())
  const eventDate = parseManilaDateKey(dateKey)
  const thisWeekStart = startOfWeekMonday(parseManilaDateKey(todayKey))
  const lastWeekStart = new Date(thisWeekStart)
  lastWeekStart.setDate(lastWeekStart.getDate() - 7)

  if (eventDate >= thisWeekStart) return "this_week"
  if (eventDate >= lastWeekStart) return "last_week"
  return "earlier"
}

export function mergeVisitRows(
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

export function groupVisitRowsIntoSessions(
  rows: VisitRow[],
  queueVisits: PatientQueueVisit[]
): VisitSession[] {
  const sessions = new Map<string, VisitSession>()
  const appointmentToSession = new Map<string, string>()
  const dayAnchor = new Map<string, string>()

  const ensureSession = (key: string, occurredAt: string): VisitSession => {
    const existing = sessions.get(key)
    if (existing) {
      if (new Date(occurredAt).getTime() > new Date(existing.sessionAt).getTime()) {
        existing.sessionAt = occurredAt
      }
      return existing
    }
    const session: VisitSession = {
      key,
      sessionAt: occurredAt,
      sessionDateKey: manilaDateKey(occurredAt),
      rows: [],
    }
    sessions.set(key, session)
    return session
  }

  for (const q of queueVisits) {
    const key = `queue-${q.id}`
    const at = q.completed_at ?? q.checked_in_at
    ensureSession(key, at)
    if (q.appointment_id) appointmentToSession.set(q.appointment_id, key)
    dayAnchor.set(manilaDateKey(at), key)
  }

  const resolveSessionKey = (row: VisitRow): string => {
    if (row.kind === "queue_visit") {
      return row.id
    }

    if (row.kind === "appointment") {
      const appointmentId = row.id.replace(/^appointment-/, "")
      const linked = appointmentToSession.get(appointmentId)
      if (linked) return linked
    }

    const dateKey = manilaDateKey(row.occurredAt)
    const queueDay = dayAnchor.get(dateKey)
    if (queueDay) return queueDay

    const dayKey = `day-${dateKey}`
    if (!sessions.has(dayKey)) {
      ensureSession(dayKey, row.occurredAt)
      dayAnchor.set(dateKey, dayKey)
    }
    return dayKey
  }

  for (const row of rows) {
    const key = resolveSessionKey(row)
    ensureSession(key, row.occurredAt).rows.push(row)
  }

  for (const session of sessions.values()) {
    session.rows.sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
    )
  }

  return [...sessions.values()].sort(
    (a, b) => new Date(b.sessionAt).getTime() - new Date(a.sessionAt).getTime()
  )
}

export function groupSessionsByWeek(sessions: VisitSession[]): GroupedVisitHistory {
  const buckets: Record<VisitWeekBucket, VisitSession[]> = {
    this_week: [],
    last_week: [],
    earlier: [],
  }

  for (const session of sessions) {
    buckets[getVisitWeekBucket(session.sessionDateKey)].push(session)
  }

  const order: VisitWeekBucket[] = ["this_week", "last_week", "earlier"]
  return order
    .filter((bucket) => buckets[bucket].length > 0)
    .map((bucket) => ({ bucket, sessions: buckets[bucket] }))
}
