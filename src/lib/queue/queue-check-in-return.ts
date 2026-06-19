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

export function savePendingQueueCheckIn(pending: PendingQueueCheckInInput) {
  if (typeof window === "undefined") return
  sessionStorage.setItem(
    PENDING_QUEUE_CHECKIN_KEY,
    JSON.stringify({ ...pending, savedAt: Date.now() } satisfies PendingQueueCheckIn)
  )
}

export function loadPendingQueueCheckIn(): PendingQueueCheckIn | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(PENDING_QUEUE_CHECKIN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingQueueCheckIn
    if (!parsed?.patientId || !parsed?.mode) return null
    // Expire after 2 hours
    if (Date.now() - (parsed.savedAt ?? 0) > 2 * 60 * 60 * 1000) {
      sessionStorage.removeItem(PENDING_QUEUE_CHECKIN_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearPendingQueueCheckIn() {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(PENDING_QUEUE_CHECKIN_KEY)
}

/** Append returnTo=queue and persist pending check-in before leaving the queue page. */
export function hrefWithQueueReturn(href: string, pending: PendingQueueCheckInInput): string {
  savePendingQueueCheckIn(pending)
  const url = new URL(href, "http://local")
  url.searchParams.set("returnTo", "queue")
  return `${url.pathname}${url.search}`
}

export function queueResumeHref(pending?: PendingQueueCheckInInput | null): string {
  const params = new URLSearchParams({ resumeCheckIn: "1" })
  if (pending?.patientId) params.set("checkInPatient", pending.patientId)
  if (pending?.patientName) params.set("checkInName", pending.patientName)
  if (pending?.appointmentId) params.set("checkInAppointment", pending.appointmentId)
  return `/queue?${params.toString()}`
}
