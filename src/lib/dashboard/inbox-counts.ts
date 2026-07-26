import type { DashboardStats } from "@/lib/dashboard/dashboard-service"

/** Count of actionable automation-inbox follow-ups (excludes always-visible cron chips). */
export function countInboxFollowUps(stats: DashboardStats, noShows = 0): number {
  return (
    (stats.appointments_awaiting_checkin ?? 0) +
    (stats.overdue_invoices ?? 0) +
    noShows +
    (stats.pending_consents ?? 0) +
    (stats.open_encounters_stale ?? 0) +
    (stats.overdue_lab_cases ?? 0)
  )
}
