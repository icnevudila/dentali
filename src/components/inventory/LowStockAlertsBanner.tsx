"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useLocale } from "@/hooks/use-locale"
import type { LowStockAlert } from "@/lib/inventory/inventory-service"

interface LowStockAlertsBannerProps {
  alerts: LowStockAlert[]
  onDismiss?: () => void
  showViewAll?: boolean
}

const TYPE_VARIANT: Record<string, "warning" | "danger"> = {
  low: "warning",
  critical: "danger",
  expired: "danger",
}

export function LowStockAlertsBanner({ alerts, onDismiss, showViewAll }: LowStockAlertsBannerProps) {
  const { t } = useLocale()
  if (alerts.length === 0) return null

  const criticalCount = alerts.filter((a) => a.alert_type === "critical" || a.alert_type === "expired").length

  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        criticalCount > 0
          ? "border-red-200 bg-red-50"
          : "border-amber-200 bg-amber-50"
      }`}
      role="alert"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3 min-w-0">
          <AlertTriangle
            className={`h-5 w-5 shrink-0 mt-0.5 ${
              criticalCount > 0 ? "text-red-600" : "text-amber-600"
            }`}
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-900">
              {t("inventory.alertsTitle", `${alerts.length} supply alerts`).replace(
                "{count}",
                String(alerts.length)
              )}
            </p>
            <ul className="mt-2 space-y-1">
              {alerts.slice(0, 5).map((alert) => (
                <li key={alert.id} className="text-sm text-neutral-700 flex flex-wrap items-center gap-2">
                  <span className="font-medium truncate">{alert.name}</span>
                  <Badge variant={TYPE_VARIANT[alert.alert_type] ?? "warning"} className="text-[10px]">
                    {alert.alert_type}
                  </Badge>
                  <span className="text-neutral-500">
                    {alert.quantity_on_hand} / {alert.min_stock_level} {alert.unit}
                  </span>
                  {(() => {
                    const qty = Math.max(
                      0,
                      Math.ceil(
                        Math.max(alert.min_stock_level * 2, alert.min_stock_level + 1) -
                          alert.quantity_on_hand
                      )
                    )
                    return qty > 0 ? (
                      <span className="text-xs text-primary-700 font-medium">→ reorder +{qty}</span>
                    ) : null
                  })()}
                </li>
              ))}
            </ul>
            {alerts.length > 5 && (
              <p className="text-xs text-neutral-500 mt-1">
                +{alerts.length - 5} {t("inventory.alertsMore", "more")}
              </p>
            )}
            {showViewAll && (
              <Button variant="link" size="sm" className="h-auto p-0 mt-1" asChild>
                <Link href="/inventory?alerts=1">
                  {t("inventory.viewAllAlerts", "View all alerts")}
                </Link>
              </Button>
            )}
          </div>
        </div>
        {onDismiss && (
          <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={onDismiss} aria-label={t("common.cancel", "Dismiss")}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
