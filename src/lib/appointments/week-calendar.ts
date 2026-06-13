import type { AppointmentRecord } from "@/lib/appointments/types"

const MANILA_TZ = "Asia/Manila"
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function manilaWeekday(date: Date): number {
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TZ,
    weekday: "short",
  }).format(date)
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  return map[wd] ?? 0
}

/** YYYY-MM-DD in Asia/Manila (clinic calendar day). */
export function toDateKey(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: MANILA_TZ })
}

/** Map an appointment ISO timestamp to its clinic calendar day. */
export function appointmentDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: MANILA_TZ })
}

export function parseDateKey(key: string): Date {
  return new Date(`${key}T12:00:00+08:00`)
}

export function addDaysToKey(key: string, days: number): string {
  const d = parseDateKey(key)
  d.setTime(d.getTime() + days * 86_400_000)
  return toDateKey(d)
}

export function startOfWeekMonday(date: Date): Date {
  const key = toDateKey(date)
  const day = manilaWeekday(date)
  const diff = day === 0 ? -6 : 1 - day
  return parseDateKey(addDaysToKey(key, diff))
}

export function addDays(date: Date, days: number): Date {
  return parseDateKey(addDaysToKey(toDateKey(date), days))
}

export function getWeekDays(weekStart: Date): Date[] {
  const startKey = toDateKey(weekStart)
  return DAY_LABELS.map((_, i) => parseDateKey(addDaysToKey(startKey, i)))
}

export function formatWeekRange(weekStart: Date): string {
  const startKey = toDateKey(weekStart)
  const endKey = addDaysToKey(startKey, 6)
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    timeZone: MANILA_TZ,
  }
  const startStr = parseDateKey(startKey).toLocaleDateString("en-PH", opts)
  const endStr = parseDateKey(endKey).toLocaleDateString("en-PH", {
    ...opts,
    year: "numeric",
  })
  return `${startStr} – ${endStr}`
}

/** Preserve Manila time-of-day when moving an appointment to another date. */
export function buildRescheduledAt(originalIso: string, targetDateKey: string): string {
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: MANILA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(originalIso))
  return new Date(`${targetDateKey}T${time}:00+08:00`).toISOString()
}

export function formatAppointmentTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-PH", {
    timeZone: MANILA_TZ,
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function groupAppointmentsByDay(
  appointments: AppointmentRecord[],
  weekDays: Date[]
): Map<string, AppointmentRecord[]> {
  const keys = new Set(weekDays.map(toDateKey))
  const map = new Map<string, AppointmentRecord[]>()
  for (const key of keys) map.set(key, [])

  for (const appt of appointments) {
    const key = appointmentDateKey(appt.scheduled_at)
    if (map.has(key)) map.get(key)!.push(appt)
  }

  for (const list of map.values()) {
    list.sort(
      (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    )
  }

  return map
}

export { DAY_LABELS, MANILA_TZ }
