"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { useBranch } from "@/hooks/use-branch"
import { fetchDashboardStats, type DashboardStats } from "@/lib/dashboard/dashboard-service"
import { getShowcaseSnapshot } from "@/lib/showcase/intercept"

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
}

const REALTIME_TABLES = [
  "queue_entries",
  "appointments",
  "patient_consents",
  "invoices",
  "invoice_payments",
  "patients",
  "inventory_items",
  "waitlist_entries",
] as const

export function useDashboardStats() {
  const { activeBranch, branchRevision } = useBranch()
  const [stats, setStats] = React.useState<DashboardStats>(EMPTY_STATS)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [live, setLive] = React.useState(false)
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null)
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const reload = React.useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!activeBranch) return
      if (!opts?.silent) setLoading(true)
      const { data, error: err } = await fetchDashboardStats(activeBranch.id)
      if (data) {
        setStats(data)
        setLastUpdated(new Date())
      }
      setError(err)
      setLoading(false)
    },
    [activeBranch]
  )

  React.useEffect(() => {
    if (!activeBranch) {
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
  }, [activeBranch?.id, branchRevision, reload])

  React.useEffect(() => {
    if (!activeBranch || getShowcaseSnapshot()) return

    const supabase = createClient()
    const branchId = activeBranch.id
    const scheduleReload = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        void reload({ silent: true })
      }, 400)
    }

    let channel = supabase.channel(`dashboard-kpi-${branchId}`)

    for (const table of REALTIME_TABLES) {
      const filter =
        table === "invoice_payments" || table === "patients"
          ? undefined
          : `branch_id=eq.${branchId}`

      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          ...(filter ? { filter } : {}),
        },
        scheduleReload
      )
    }

    channel.subscribe((status: any) => {
      setLive(status === "SUBSCRIBED")
    })

    const fallbackInterval = setInterval(() => {
      void reload({ silent: true })
    }, 120_000)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      clearInterval(fallbackInterval)
      setLive(false)
      supabase.removeChannel(channel)
    }
  }, [activeBranch?.id, reload])

  return { stats, loading, error, live, lastUpdated, reload }
}
