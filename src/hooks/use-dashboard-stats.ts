"use client"

import * as React from "react"
import { useBranch } from "@/hooks/use-branch"
import { fetchDashboardStats, type DashboardStats } from "@/lib/dashboard/dashboard-service"
import { subscribeDashboardKpiRealtime } from "@/lib/dashboard/dashboard-realtime"
import { getShowcaseSnapshot } from "@/lib/showcase/intercept"
import { fetchAppointments } from "@/lib/appointments/appointment-service"
import { fetchQueueEntriesForDay } from "@/lib/queue/queue-service"
import { filterPendingCheckInAppointments } from "@/lib/queue/pending-arrivals"
import { toDateKey } from "@/lib/appointments/week-calendar"

const EMPTY_STATS: DashboardStats = {
  active_patients: 0,
  today_appointments: 0,
  pending_consents: 0,
  queue_waiting: 0,
  waitlist_waiting: 0,
  open_invoices: 0,
  overdue_invoices: 0,
  today_collected: 0,
  low_stock_items: 0,
  missing_clinical_notes: 0,
  hmo_draft_claims: 0,
  philhealth_pending: 0,
  pending_intake_drafts: 0,
  appointments_awaiting_checkin: 0,
  open_encounters_stale: 0,
}

export function useDashboardStats() {
  const { activeBranch, branchRevision } = useBranch()
  const [stats, setStats] = React.useState<DashboardStats>(EMPTY_STATS)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [live, setLive] = React.useState(false)
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null)

  const branchId = activeBranch?.id

  const reload = React.useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!branchId) return
      if (!opts?.silent) setLoading(true)
      const today = toDateKey(new Date())
      const [statsRes, appointmentsRes, queueRes] = await Promise.all([
        fetchDashboardStats(branchId),
        fetchAppointments(branchId, today),
        fetchQueueEntriesForDay(branchId, today),
      ])
      const { data, error: err } = statsRes
      if (data) {
        const normalizedAwaiting = filterPendingCheckInAppointments(
          appointmentsRes.data,
          queueRes.data
        ).length
        const normalizedQueueWaiting = queueRes.data.filter((e) =>
          ["waiting", "ready", "now_serving", "in_chair"].includes(e.status)
        ).length
        setStats({
          ...data,
          appointments_awaiting_checkin: normalizedAwaiting,
          queue_waiting: normalizedQueueWaiting,
        })
        setLastUpdated(new Date())
      }
      setError(err ?? appointmentsRes.error ?? queueRes.error)
      setLoading(false)
    },
    [branchId]
  )

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      if (!branchId) {
        setLoading(false)
        setLive(false)
        return
      }
      if (getShowcaseSnapshot()) {
        setStats(getShowcaseSnapshot()!.stats)
        setLoading(false)
        setLive(false)
        setLastUpdated(new Date())
        setError(null)
        return
      }
      void reload()
    }, 0)
    return () => window.clearTimeout(id)
  }, [branchId, branchRevision, reload])

  React.useEffect(() => {
    if (!branchId || getShowcaseSnapshot()) return

    const unsubscribe = subscribeDashboardKpiRealtime(
      branchId,
      () => {
        void reload({ silent: true })
      },
      setLive
    )

    const fallbackInterval = setInterval(() => {
      void reload({ silent: true })
    }, 120_000)

    return () => {
      clearInterval(fallbackInterval)
      setLive(false)
      unsubscribe()
    }
  }, [branchId, reload])

  return { stats, loading, error, live, lastUpdated, reload }
}
