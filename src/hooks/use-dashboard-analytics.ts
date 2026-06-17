"use client"

import { useCallback, useEffect, useState } from "react"
import {
  fetchAppointmentsAnalytics,
  fetchFinanceSummaryAnalytics,
  fetchHmoPipelineAnalytics,
  fetchInventoryAnalytics,
  fetchKioskAnalytics,
  fetchNotificationAnalytics,
  fetchPatientsAnalytics,
  fetchPhilHealthAnalytics,
  fetchQueueAnalytics,
  fetchWaitlistAnalytics,
  fetchBranchChartConditionAnalytics,
  fetchOrthoAnalytics,
  type AppointmentsAnalytics,
  type FinanceSummaryAnalytics,
  type HmoPipelineAnalytics,
  type InventoryAnalytics,
  type KioskAnalytics,
  type NotificationAnalytics,
  type PatientsAnalytics,
  type PhilHealthAnalytics,
  type QueueAnalytics,
  type WaitlistAnalytics,
  type OrthoAnalytics,
} from "@/lib/analytics/analytics-service"
import { useBranch } from "@/hooks/use-branch"
import { useOperationalRefresh } from "@/hooks/use-operational-refresh"

export type DashboardAnalyticsBundle = {
  queue: QueueAnalytics | null
  appointments: AppointmentsAnalytics | null
  waitlist: WaitlistAnalytics | null
  patients: PatientsAnalytics | null
  inventory: InventoryAnalytics | null
  finance: FinanceSummaryAnalytics | null
  hmo: HmoPipelineAnalytics | null
  philhealth: PhilHealthAnalytics | null
  notifications: NotificationAnalytics | null
  kiosk: KioskAnalytics | null
  ortho: OrthoAnalytics | null
  chartConditions: { items: { label: string; value: number }[]; totalFindings: number }
}

const EMPTY_BUNDLE: DashboardAnalyticsBundle = {
  queue: null,
  appointments: null,
  waitlist: null,
  patients: null,
  inventory: null,
  finance: null,
  hmo: null,
  philhealth: null,
  notifications: null,
  kiosk: null,
  ortho: null,
  chartConditions: { items: [], totalFindings: 0 },
}

export function useDashboardAnalytics(periodDays: number) {
  const { activeBranch } = useBranch()
  const [data, setData] = useState<DashboardAnalyticsBundle>(EMPTY_BUNDLE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const patientPeriod = periodDays < 30 ? 30 : periodDays

  const reload = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!activeBranch) {
        setData(EMPTY_BUNDLE)
        setLoading(false)
        setError(null)
        return
      }

      if (!opts?.silent) setLoading(true)
      setError(null)

      const branchId = activeBranch.id

      try {
        const [
          queueRes,
          appointmentsRes,
          waitlistRes,
          patientsRes,
          inventoryRes,
          financeRes,
          hmoRes,
          philhealthRes,
          notificationsRes,
          kioskRes,
          orthoRes,
          chartRes,
        ] = await Promise.all([
          fetchQueueAnalytics(branchId, periodDays),
          fetchAppointmentsAnalytics(branchId, periodDays),
          fetchWaitlistAnalytics(branchId, patientPeriod),
          fetchPatientsAnalytics(branchId, patientPeriod),
          fetchInventoryAnalytics(branchId),
          fetchFinanceSummaryAnalytics(branchId),
          fetchHmoPipelineAnalytics(branchId),
          fetchPhilHealthAnalytics(branchId),
          fetchNotificationAnalytics(branchId, periodDays),
          fetchKioskAnalytics(branchId, periodDays),
          fetchOrthoAnalytics(branchId),
          fetchBranchChartConditionAnalytics(branchId),
        ])

        const firstError =
          queueRes.error ??
          appointmentsRes.error ??
          waitlistRes.error ??
          patientsRes.error ??
          inventoryRes.error ??
          financeRes.error

        setError(firstError)
        setData({
          queue: queueRes.data,
          appointments: appointmentsRes.data,
          waitlist: waitlistRes.data,
          patients: patientsRes.data,
          inventory: inventoryRes.data,
          finance: financeRes.data,
          hmo: hmoRes.data,
          philhealth: philhealthRes.data,
          notifications: notificationsRes.data,
          kiosk: kioskRes.data,
          ortho: orthoRes.data,
          chartConditions: {
            items: chartRes.data,
            totalFindings: chartRes.totalFindings,
          },
        })
      } catch {
        setError("Failed to load dashboard analytics")
      } finally {
        setLoading(false)
      }
    },
    [activeBranch, periodDays, patientPeriod]
  )

  useEffect(() => {
    const id = window.setTimeout(() => {
      void reload()
    }, 0)
    return () => window.clearTimeout(id)
  }, [reload])

  useOperationalRefresh(
    ["appointments", "queue_entries", "invoices", "patient_intakes", "inventory_items"],
    () => {
      void reload({ silent: true })
    },
    { debounceMs: 1200 }
  )

  return { data, loading, error, reload, hasBranch: !!activeBranch }
}
