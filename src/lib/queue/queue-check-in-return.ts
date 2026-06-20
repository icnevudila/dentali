export const PENDING_QUEUE_CHECKIN_KEY = "pending-queue-check-in"

export type PendingQueueCheckIn = {
  patientId: string
  patientName?: string
  mode: "walk_in" | "appointment_check_in"
  appointmentId?: string
  notes?: string
  forceBillingOverride?: boolean
  forceCheckin?: boolean
  reuseEncounterId?: string | null
  gateKind?: "consent" | "billing"
  savedAt: number
}

export type PendingQueueCheckInInput = Omit<PendingQueueCheckIn, "savedAt">

const PENDING_TTL_MS = 2 * 60 * 60 * 1000

function serializePending(pending: PendingQueueCheckInInput): string {
  return JSON.stringify({ ...pending, savedAt: Date.now() } satisfies PendingQueueCheckIn)
}

function parsePending(raw: string | null): PendingQueueCheckIn | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as PendingQueueCheckIn
    if (!parsed?.patientId || !parsed?.mode) return null
    if (Date.now() - (parsed.savedAt ?? 0) > PENDING_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

export function savePendingQueueCheckIn(pending: PendingQueueCheckInInput) {
  if (typeof window === "undefined") return
  const serialized = serializePending(pending)
  sessionStorage.setItem(PENDING_QUEUE_CHECKIN_KEY, serialized)
  try {
    localStorage.setItem(PENDING_QUEUE_CHECKIN_KEY, serialized)
  } catch {
    // ignore quota / private mode
  }
}

export function loadPendingQueueCheckIn(): PendingQueueCheckIn | null {
  if (typeof window === "undefined") return null

  const fromSession = parsePending(sessionStorage.getItem(PENDING_QUEUE_CHECKIN_KEY))
  if (fromSession) return fromSession

  const fromLocal = parsePending(localStorage.getItem(PENDING_QUEUE_CHECKIN_KEY))
  if (fromLocal) return fromLocal

  return null
}

export function clearPendingQueueCheckIn() {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(PENDING_QUEUE_CHECKIN_KEY)
  try {
    localStorage.removeItem(PENDING_QUEUE_CHECKIN_KEY)
  } catch {
    // ignore
  }
}

/** Append returnTo=queue and persist pending check-in before leaving the queue page. */
export function hrefWithQueueReturn(href: string, pending: PendingQueueCheckInInput): string {
  savePendingQueueCheckIn(pending)
  const url = new URL(href, "http://local")
  url.searchParams.set("returnTo", "queue")
  return `${url.pathname}${url.search}`
}

/** Open consent in a new tab; queue page stays open and receives a sign event via BroadcastChannel. */
export function openQueueConsentWindow(href: string, pending: PendingQueueCheckInInput): boolean {
  if (typeof window === "undefined") return false

  savePendingQueueCheckIn(pending)
  const parsed = new URL(href, window.location.origin)
  const url = new URL(parsed.pathname, window.location.origin)
  url.searchParams.set("returnTo", "queue")
  url.searchParams.set("popup", "1")

  const popup = window.open(url.toString(), "_blank")
  return popup != null
}

export function queueResumeHref(pending?: PendingQueueCheckInInput | null): string {
  const params = new URLSearchParams({ resumeCheckIn: "1" })
  if (pending?.patientId) params.set("checkInPatient", pending.patientId)
  if (pending?.patientName) params.set("checkInName", pending.patientName)
  if (pending?.appointmentId) params.set("checkInAppointment", pending.appointmentId)
  return `/queue?${params.toString()}`
}
