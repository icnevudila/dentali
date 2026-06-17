"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { useSearchParams, useRouter } from "next/navigation"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { useAuth } from "@/hooks/use-auth"
import { fetchOrganization } from "@/lib/auth/auth-service"
import { toast } from "sonner"
import {
  adjustInventoryStock,
  createInventoryItem,
  fetchInventoryItems,
  fetchLowStockAlerts,
  stockLevel,
  suggestedReorderQty,
  updateInventoryItem,
  type InventoryItem,
  type LowStockAlert,
} from "@/lib/inventory/inventory-service"
import { LowStockAlertsBanner } from "@/components/inventory/LowStockAlertsBanner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Plus, Package, MapPin, AlertTriangle, Edit } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { SectionEyebrow } from "@/components/layout/SectionEyebrow"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { DirectionalTransition } from "@/components/layout/DirectionalTransition"
import { MetricStrip } from "@/components/layout/MetricStrip"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { ReportDrillLink } from "@/components/reports/ReportDrillLink"

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
  const router = useRouter()
  const alertsOnly =
    searchParams.get("alerts") === "1" || searchParams.get("focus") === "low-stock"
  const [items, setItems] = React.useState<InventoryItem[]>([])
  const [alerts, setAlerts] = React.useState<LowStockAlert[]>([])
  const [bannerDismissed, setBannerDismissed] = React.useState(false)
  const [alertsFilter, setAlertsFilter] = React.useState(alertsOnly)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [showAdd, setShowAdd] = React.useState(false)
  const [editingItem, setEditingItem] = React.useState<InventoryItem | null>(null)
  const [name, setName] = React.useState("")
  const [sku, setSku] = React.useState("")
  const [category, setCategory] = React.useState("")
  const [unit, setUnit] = React.useState("pc")
  const [minStock, setMinStock] = React.useState("5")
  const [initialQty, setInitialQty] = React.useState("0")
  const [expiry, setExpiry] = React.useState("")
  const [supplier, setSupplier] = React.useState("")
  const [brand, setBrand] = React.useState("")
  const [unitCost, setUnitCost] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [adjustId, setAdjustId] = React.useState<string | null>(null)
  const [adjustQty, setAdjustQty] = React.useState("")

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image file size should be less than 2MB")
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        setBrand(reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

  const resetForm = () => {
    setName("")
    setSku("")
    setCategory("")
    setUnit("pc")
    setMinStock("5")
    setInitialQty("0")
    setExpiry("")
    setSupplier("")
    setBrand("")
    setUnitCost("")
  }

  const handleEditClick = (item: InventoryItem) => {
    setEditingItem(item)
    setName(item.name || "")
    setSku(item.sku || "")
    setCategory(item.category || "")
    setUnit(item.unit || "pc")
    setMinStock(String(item.min_stock_level))
    setExpiry(item.expiry_date || "")
    setSupplier(item.supplier || "")
    setBrand(item.brand || "")
    setUnitCost(String(item.unit_cost || ""))
  }


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

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      load()
    }, 0)
    return () => window.clearTimeout(id)
  }, [load])

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      setAlertsFilter(alertsOnly)
    }, 0)
    return () => window.clearTimeout(id)
  }, [alertsOnly])

  const alertIds = React.useMemo(() => new Set(alerts.map((a) => a.id)), [alerts])
  const displayedItems = alertsFilter
    ? items.filter((i) => alertIds.has(i.id))
    : items
  const lowCount = alerts.length

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !activeBranch || !name.trim()) return
    setSaving(true)
    const org = await fetchOrganization()
    if (!org) { setError("Organization not found"); setSaving(false); return }

    if (editingItem) {
      const { error: err } = await updateInventoryItem(editingItem.id, {
        name: name.trim(),
        sku: sku || undefined,
        category: category || undefined,
        unit: unit || undefined,
        minStockLevel: parseFloat(minStock) || 0,
        expiryDate: expiry || null,
        supplier: supplier || undefined,
        brand: brand || null,
        unitCost: parseFloat(unitCost) || 0,
      })
      setSaving(false)
      if (err) {
        toast.error(err)
        setError(err)
      } else {
        toast.success("Item updated successfully")
        setEditingItem(null)
        resetForm()
        load()
      }
    } else {
      const { error: err } = await createInventoryItem({
        organizationId: org.id,
        branchId: activeBranch.id,
        name: name.trim(),
        sku: sku || undefined,
        category: category || undefined,
        unit: unit || undefined,
        minStockLevel: parseFloat(minStock) || 0,
        expiryDate: expiry || undefined,
        initialQty: parseFloat(initialQty) || 0,
        userId: user.id,
        supplier: supplier || undefined,
        brand: brand || undefined,
        unitCost: parseFloat(unitCost) || 0,
      })
      setSaving(false)
      if (err) {
        toast.error(err)
        setError(err)
      } else {
        toast.success("Item added successfully")
        setShowAdd(false)
        resetForm()
        load()
      }
    }
  }

  const handleStockIn = async (itemId: string) => {
    const qty = parseFloat(adjustQty)
    if (!qty || qty <= 0) return
    setAdjustId(itemId)
    const { error: err } = await adjustInventoryStock(itemId, "in", qty)
    setAdjustId(null)
    setAdjustQty("")
    if (err) {
      toast.error(err)
      setError(err)
    } else {
      toast.success(`Stock increased by ${qty}`)
      load()
    }
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
      hint: t("inventory.metricLowHint", "Below minimum — tap to filter"),
      variant: lowCount > 0 ? ("warning" as const) : ("default" as const),
      icon: AlertTriangle,
      onClick: () => router.replace("/inventory?alerts=1", { scroll: false }),
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

          {activeBranch ? (
            <ReportDrillLink
              title={t("inventory.reportsTitle", "Stock risk analytics")}
              description={t(
                "inventory.reportsDescription",
                "Low-stock trends and supply pressure are tracked in Reports compliance."
              )}
              href="/reports#compliance"
              linkLabel={t("inventory.openReports", "Open inventory reports")}
            />
          ) : null}

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

        {(showAdd || editingItem) && createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl bg-white shadow-xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
              <div className="p-6 overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-neutral-900">
                    {editingItem ? "Edit inventory item" : t("inventory.newItem", "New inventory item")}
                  </h2>
                </div>
                <form onSubmit={handleSave} className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2 space-y-2">
                    <label className="text-xs text-neutral-500 font-medium">Product Image</label>
                    <div className="flex items-center gap-3">
                      {brand && (brand.startsWith("http") || brand.startsWith("data:image/")) ? (
                        <div className="relative w-16 h-16 rounded-md border overflow-hidden shrink-0 group">
                          <img src={brand} alt="Preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            className="absolute inset-0 bg-black/50 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setBrand("")}
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div className="w-16 h-16 bg-neutral-50 border border-dashed rounded-md flex items-center justify-center text-neutral-400 shrink-0">
                          <Package className="w-6 h-6" />
                        </div>
                      )}
                      <div className="flex-1 space-y-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                          id="image-file-input"
                        />
                        <label
                          htmlFor="image-file-input"
                          className="inline-flex items-center justify-center rounded-md text-xs font-medium border border-neutral-200 bg-white px-3 py-2 text-neutral-700 shadow-sm hover:bg-neutral-50 cursor-pointer w-full text-center"
                        >
                          Upload File
                        </label>
                        <div className="text-[10px] text-neutral-400 text-center">or enter image URL below:</div>
                      </div>
                    </div>
                    <Input
                      placeholder="https://..."
                      value={brand && brand.startsWith("data:image/") ? "" : brand}
                      onChange={(e) => setBrand(e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Input placeholder="Item name *" required value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <Input placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} />
                  <Input placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
                  <Input placeholder="Unit (e.g. pc, box, syringe)" value={unit} onChange={(e) => setUnit(e.target.value)} />
                  <Input placeholder="Supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
                  <Input type="number" step="0.01" placeholder="Unit Cost (₱)" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
                  <Input type="number" placeholder="Min stock" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
                  {!editingItem && (
                    <Input type="number" placeholder="Initial qty" value={initialQty} onChange={(e) => setInitialQty(e.target.value)} />
                  )}
                  <div className={editingItem ? "sm:col-span-2" : ""}>
                    <Input type="date" placeholder="Expiry" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
                  </div>
                  <div className="sm:col-span-2 flex justify-end gap-2 mt-2 pt-2 border-t">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setShowAdd(false)
                        setEditingItem(null)
                        resetForm()
                      }}
                    >
                      {t("common.cancel", "Cancel")}
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {t("common.save", "Save")}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body
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
                      <th className="pb-2 text-left">Brand/Category</th>
                      <th className="pb-2 text-right">{t("inventory.onHand", "On hand")}</th>
                      <th className="pb-2 text-right">Cost</th>
                      <th className="pb-2 text-left">{t("inventory.status", "Status")}</th>
                      <th className="pb-2 text-left">{t("inventory.expiry", "Expiry")}</th>
                      <th className="pb-2 text-right">{t("inventory.reorderSuggest", "Reorder")}</th>
                      <th className="pb-2 text-right">{t("inventory.stockIn", "Stock in")}</th>
                      <th className="pb-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {displayedItems.map((item) => {
                      const level = stockLevel(item)
                      const reorderQty = suggestedReorderQty(item)
                      return (
                        <tr key={item.id} className={level === "critical" || level === "expired" ? "border-l-4 border-l-red-500" : level === "low" ? "border-l-4 border-l-amber-400" : ""}>
                          <td className="py-2 font-medium">
                            <div className="flex items-center gap-3">
                              {item.brand && (item.brand.startsWith("http") || item.brand.startsWith("data:image/")) ? (
                                <img src={item.brand} alt={item.name} className="w-10 h-10 object-cover rounded-md border border-neutral-200 shrink-0" />
                              ) : (
                                <div className="w-10 h-10 bg-neutral-100 border border-neutral-200 rounded-md flex items-center justify-center text-neutral-400 shrink-0">
                                  <Package className="w-5 h-5" />
                                </div>
                              )}
                              <div>
                                {item.name}
                                <div className="text-[10px] text-neutral-400 font-mono">{item.sku ?? "—"}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2 text-xs text-neutral-500">
                            {(!item.brand || (!item.brand.startsWith("http") && !item.brand.startsWith("data:image/"))) && item.brand ? <span className="font-semibold">{item.brand}</span> : null}
                            {(!item.brand || (!item.brand.startsWith("http") && !item.brand.startsWith("data:image/"))) && item.brand && item.category ? " / " : ""}
                            {item.category}
                          </td>
                          <td className="py-2 text-right">{item.quantity_on_hand} {item.unit}</td>
                          <td className="py-2 text-right text-neutral-600">₱{item.unit_cost?.toLocaleString() ?? "0"}</td>
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
                          <td className="py-2 text-right">
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleEditClick(item)}>
                              <Edit className="h-4 w-4 text-neutral-500 hover:text-neutral-700" />
                            </Button>
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
