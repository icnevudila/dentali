"use client"

import { useCallback, useEffect, useState } from "react"
import {
  fetchInventoryAnalytics,
  fetchInventoryMovementAnalytics,
} from "@/lib/analytics/analytics-service"
import { fetchInventoryItems, type InventoryItem } from "@/lib/inventory/inventory-service"
import { TrendArea } from "@/components/charts/ChartKit"
import { ModuleAnalyticsPanel } from "@/components/analytics/ModuleAnalyticsPanel"
import { useLocale } from "@/hooks/use-locale"

function buildExpiryBuckets(items: InventoryItem[]): { label: string; value: number }[] {
  const now = new Date()
  const in30 = new Date(now)
  in30.setDate(in30.getDate() + 30)
  const in90 = new Date(now)
  in90.setDate(in90.getDate() + 90)

  let expired = 0
  let within30 = 0
  let within90 = 0
  let later = 0
  let noExpiry = 0

  for (const item of items) {
    if (!item.expiry_date) {
      noExpiry += 1
      continue
    }
    const expiry = new Date(item.expiry_date)
    if (expiry < now) expired += 1
    else if (expiry <= in30) within30 += 1
    else if (expiry <= in90) within90 += 1
    else later += 1
  }

  return [
    { label: "Expired", value: expired },
    { label: "< 30d", value: within30 },
    { label: "31–90d", value: within90 },
    { label: "> 90d", value: later },
    { label: "No date", value: noExpiry },
  ]
}

export function InventoryAnalyticsPanel({ branchId }: { branchId: string }) {
  const { t } = useLocale()
  const [loading, setLoading] = useState(true)
  const [lowStock, setLowStock] = useState(0)
  const [totalSkus, setTotalSkus] = useState(0)
  const [levels, setLevels] = useState<{ label: string; value: number }[]>([])
  const [movement, setMovement] = useState<{ label: string; value: number }[]>([])
  const [expiryBuckets, setExpiryBuckets] = useState<{ label: string; value: number }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const [stock, move, items] = await Promise.all([
      fetchInventoryAnalytics(branchId),
      fetchInventoryMovementAnalytics(branchId, 30),
      fetchInventoryItems(branchId),
    ])
    if (stock.data) {
      setLowStock(stock.data.lowStockCount)
      setTotalSkus(stock.data.totalSkus)
      setLevels(stock.data.stockLevels)
    }
    if (move.data) {
      setMovement(move.data.movementTrend.map((m) => ({ label: m.label, value: m.value })))
    }
    if (!items.error) {
      setExpiryBuckets(buildExpiryBuckets(items.data))
    }
    setLoading(false)
  }, [branchId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <p className="text-xs font-medium text-neutral-500">
            {t("inventory.lowStock", "Low stock SKUs")}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-700">
            {loading ? "—" : lowStock}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <p className="text-xs font-medium text-neutral-500">
            {t("inventory.totalSkus", "Active SKUs")}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
            {loading ? "—" : totalSkus}
          </p>
        </div>
      </div>
      <ModuleAnalyticsPanel
        title={t("inventory.stockBreakdown", "Stock health")}
        variant="pie"
        data={levels}
        loading={loading}
        height={200}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <ModuleAnalyticsPanel
          title={t("inventory.expiryTimeline", "Expiry timeline")}
          subtitle={t("inventory.expiryTimelineHint", "SKUs by expiry window")}
          variant="funnel"
          funnelSteps={expiryBuckets.map((s) => ({ label: s.label, value: s.value }))}
          loading={loading}
          height={180}
        />
        <div className="rounded-xl border border-neutral-200/80 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-neutral-900">
            {t("inventory.movementTrend", "Stock movement (30d)")}
          </h3>
          <TrendArea
            data={movement}
            height={180}
            emptyLabel={t("inventory.noMovement", "No movement data")}
          />
        </div>
      </div>
    </div>
  )
}
