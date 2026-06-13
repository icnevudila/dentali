"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { useAuth } from "@/hooks/use-auth"
import { fetchOrganization } from "@/lib/auth/auth-service"
import {
  adjustInventoryStock,
  createInventoryItem,
  fetchInventoryItems,
  fetchLowStockAlerts,
  stockLevel,
  suggestedReorderQty,
  type InventoryItem,
  type LowStockAlert,
} from "@/lib/inventory/inventory-service"
import { LowStockAlertsBanner } from "@/components/inventory/LowStockAlertsBanner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Plus, Package, MapPin, AlertTriangle } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { SectionEyebrow } from "@/components/layout/SectionEyebrow"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { DirectionalTransition } from "@/components/layout/DirectionalTransition"
import { MetricStrip } from "@/components/layout/MetricStrip"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { InventoryAnalyticsPanel } from "@/components/analytics/InventoryAnalyticsPanel"

const LEVEL_VARIANT: Record<string, "default" | "success" | "warning" | "danger"> = {
  ok: "success",
  low: "warning",
  critical: "danger",
  expired: "danger",
}

function InventoryPageContent() {
  const { activeBranch } = useBranch()
  const { user } = useAuth()
  const { t } = useLocale()
  const searchParams = useSearchParams()
  const alertsOnly = searchParams.get("alerts") === "1"
  const [items, setItems] = React.useState<InventoryItem[]>([])
  const [alerts, setAlerts] = React.useState<LowStockAlert[]>([])
  const [bannerDismissed, setBannerDismissed] = React.useState(false)
  const [alertsFilter, setAlertsFilter] = React.useState(alertsOnly)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [showAdd, setShowAdd] = React.useState(false)
  const [name, setName] = React.useState("")
  const [sku, setSku] = React.useState("")
  const [category, setCategory] = React.useState("")
  const [minStock, setMinStock] = React.useState("5")
  const [initialQty, setInitialQty] = React.useState("0")
  const [expiry, setExpiry] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [adjustId, setAdjustId] = React.useState<string | null>(null)
  const [adjustQty, setAdjustQty] = React.useState("")

  const load = React.useCallback(() => {
    if (!activeBranch) return
    setLoading(true)
    Promise.all([
      fetchInventoryItems(activeBranch.id),
      fetchLowStockAlerts(activeBranch.id),
    ]).then(([itemsResult, alertsResult]) => {
      setItems(itemsResult.data)
      setAlerts(alertsResult.data)
      setError(itemsResult.error ?? alertsResult.error)
      setLoading(false)
    })
  }, [activeBranch])

  React.useEffect(() => { load() }, [load])

  React.useEffect(() => {
    setAlertsFilter(alertsOnly)
  }, [alertsOnly])

  const alertIds = React.useMemo(() => new Set(alerts.map((a) => a.id)), [alerts])
  const displayedItems = alertsFilter
    ? items.filter((i) => alertIds.has(i.id))
    : items
  const lowCount = alerts.length

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !activeBranch || !name.trim()) return
    setSaving(true)
    const org = await fetchOrganization()
    if (!org) { setError("Organization not found"); setSaving(false); return }
    const { error: err } = await createInventoryItem({
      organizationId: org.id, branchId: activeBranch.id, name: name.trim(),
      sku: sku || undefined, category: category || undefined,
      minStockLevel: parseFloat(minStock) || 0, expiryDate: expiry || undefined,
      initialQty: parseFloat(initialQty) || 0, userId: user.id,
    })
    setSaving(false)
    if (err) setError(err)
    else { setShowAdd(false); setName(""); load() }
  }

  const handleStockIn = async (itemId: string) => {
    const qty = parseFloat(adjustQty)
    if (!qty || qty <= 0) return
    setAdjustId(itemId)
    const { error: err } = await adjustInventoryStock(itemId, "in", qty)
    setAdjustId(null)
    setAdjustQty("")
    if (err) setError(err)
    else load()
  }

  const criticalCount = items.filter((i) => stockLevel(i) === "critical" || stockLevel(i) === "expired").length

  const metricItems = [
    {
      label: t("inventory.metricItems", "Items"),
      value: loading ? "—" : items.length,
      hint: activeBranch?.name ?? t("dashboard.selectBranch", "Select a branch"),
      icon: Package,
    },
    {
      label: t("inventory.lowStock", "Low stock"),
      value: loading ? "—" : lowCount,
      hint: t("inventory.metricLowHint", "Below minimum level"),
      variant: lowCount > 0 ? ("warning" as const) : ("default" as const),
      icon: AlertTriangle,
    },
    {
      label: t("inventory.metricCritical", "Critical"),
      value: loading ? "—" : criticalCount,
      hint: t("inventory.metricCriticalHint", "Reorder now"),
      variant: criticalCount > 0 ? ("warning" as const) : ("success" as const),
    },
  ]

  return (
    <PermissionGate permission={PERMISSIONS.SETTINGS_MANAGE}>
      <DirectionalTransition className="mx-auto w-full max-w-7xl">
        <ContentPanel padding="lg" className="space-y-6">
          <SectionEyebrow icon={Package}>
            {t("inventory.eyebrow", "Operations")} · {t("inventory.title", "Inventory")}
          </SectionEyebrow>

          <PageHeader
            title={t("inventory.title", "Inventory & Supplies")}
            description={t(
              "inventory.subtitle",
              "Track stock levels, expiry dates, and low-stock alerts."
            )}
            actions={
              <Button className="gap-2 shadow-sm" onClick={() => setShowAdd(true)}>
                <Plus className="h-4 w-4" /> {t("inventory.addItem", "Add item")}
              </Button>
            }
          />

          {activeBranch ? (
            <div className="flex flex-wrap items-center gap-2 animate-fade-rise">
              <Badge variant="info" className="gap-1 font-normal">
                <MapPin className="h-3 w-3" aria-hidden />
                {activeBranch.name}
              </Badge>
              {alertsFilter ? (
                <Badge variant="warning" className="font-normal">
                  {t("inventory.filterAlerts", "Alerts only")}
                </Badge>
              ) : null}
            </div>
          ) : null}

          <MetricStrip items={metricItems} className="lg:grid-cols-3" />

          {activeBranch ? <InventoryAnalyticsPanel branchId={activeBranch.id} /> : null}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 animate-fade-rise">
              <p className="text-sm text-red-700">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={load}>
                {t("common.retry", "Retry")}
              </Button>
            </div>
          )}

        {!bannerDismissed && alerts.length > 0 && (
          <LowStockAlertsBanner alerts={alerts} onDismiss={() => setBannerDismissed(true)} />
        )}

        {alerts.length > 0 && (
          <div className="flex gap-2">
            <Button
              variant={alertsFilter ? "default" : "outline"}
              size="sm"
              onClick={() => setAlertsFilter(true)}
            >
              {t("inventory.filterAlerts", "Alerts only")} ({alerts.length})
            </Button>
            <Button
              variant={!alertsFilter ? "default" : "outline"}
              size="sm"
              onClick={() => setAlertsFilter(false)}
            >
              {t("inventory.filterAll", "All items")}
            </Button>
          </div>
        )}

        {showAdd && (
          <Card className="border-primary-200">
            <CardHeader><CardTitle className="text-base">{t("inventory.newItem", "New inventory item")}</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-2 max-w-xl">
                <Input placeholder="Item name *" required value={name} onChange={(e) => setName(e.target.value)} />
                <Input placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} />
                <Input placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
                <Input type="number" placeholder="Min stock" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
                <Input type="number" placeholder="Initial qty" value={initialQty} onChange={(e) => setInitialQty(e.target.value)} />
                <Input type="date" placeholder="Expiry" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
                <div className="sm:col-span-2 flex gap-2">
                  <Button type="submit" disabled={saving}>{t("common.save", "Save")}</Button>
                  <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>{t("common.cancel", "Cancel")}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          <SectionEyebrow icon={Package}>
            {alertsFilter
              ? t("inventory.alertList", "Low-stock items")
              : t("inventory.itemList", "All items")}
          </SectionEyebrow>

        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <PageLoadingSkeleton variant="inline" />
            ) : displayedItems.length === 0 ? (
              <div className="text-center py-16 text-neutral-500">
                <Package className="h-10 w-10 mx-auto mb-3 text-neutral-300" />
                <p>
                  {alertsFilter
                    ? t("inventory.noAlerts", "No low-stock alerts right now.")
                    : t("inventory.empty", "No inventory items yet.")}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-neutral-500">
                      <th className="pb-2 text-left">{t("inventory.item", "Item")}</th>
                      <th className="pb-2 text-left">{t("inventory.sku", "SKU")}</th>
                      <th className="pb-2 text-right">{t("inventory.onHand", "On hand")}</th>
                      <th className="pb-2 text-left">{t("inventory.status", "Status")}</th>
                      <th className="pb-2 text-left">{t("inventory.expiry", "Expiry")}</th>
                      <th className="pb-2 text-right">{t("inventory.reorderSuggest", "Reorder")}</th>
                      <th className="pb-2 text-right">{t("inventory.stockIn", "Stock in")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {displayedItems.map((item) => {
                      const level = stockLevel(item)
                      const reorderQty = suggestedReorderQty(item)
                      return (
                        <tr key={item.id} className={level === "critical" || level === "expired" ? "border-l-4 border-l-red-500" : level === "low" ? "border-l-4 border-l-amber-400" : ""}>
                          <td className="py-2 font-medium">{item.name}</td>
                          <td className="py-2 font-mono text-xs">{item.sku ?? "—"}</td>
                          <td className="py-2 text-right">{item.quantity_on_hand} {item.unit}</td>
                          <td className="py-2"><Badge variant={LEVEL_VARIANT[level]}>{level}</Badge></td>
                          <td className="py-2 text-neutral-500">{item.expiry_date ?? "—"}</td>
                          <td className="py-2 text-right text-neutral-600">
                            {reorderQty > 0 ? (
                              <button
                                type="button"
                                className="text-primary-600 hover:underline font-medium"
                                onClick={() => {
                                  setAdjustId(item.id)
                                  setAdjustQty(String(reorderQty))
                                }}
                              >
                                +{reorderQty} {item.unit}
                              </button>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-2 text-right">
                            <div className="flex justify-end gap-1">
                              <Input className="w-16 h-8 text-xs" type="number" placeholder="Qty" value={adjustId === item.id ? adjustQty : ""} onFocus={() => setAdjustId(item.id)} onChange={(e) => setAdjustQty(e.target.value)} />
                              <Button size="sm" variant="outline" disabled={adjustId === item.id && !adjustQty} onClick={() => handleStockIn(item.id)}>+</Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        </div>
        </ContentPanel>
      </DirectionalTransition>
    </PermissionGate>
  )
}

export default function InventoryPage() {
  return (
    <React.Suspense
      fallback={<PageLoadingSkeleton variant="list" />}
    >
      <InventoryPageContent />
    </React.Suspense>
  )
}
