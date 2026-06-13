"use client"

import { useCallback, useEffect, useState } from "react"
import { Monitor, Wifi, WifiOff } from "lucide-react"
import { fetchDisplayAnalytics, fetchTvDisplayAnalytics } from "@/lib/analytics/analytics-service"
import { useLocale } from "@/hooks/use-locale"
import { cn } from "@/lib/utils"

export function DisplayAnalyticsPanel({ branchId }: { branchId: string }) {
  const { t, locale } = useLocale()
  const [loading, setLoading] = useState(true)
  const [activeDisplay, setActiveDisplay] = useState(0)
  const [activeKiosk, setActiveKiosk] = useState(0)
  const [lastSession, setLastSession] = useState<string | null>(null)
  const [created7d, setCreated7d] = useState(0)
  const [isOnline, setIsOnline] = useState(false)
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null)
  const [minutesSinceRefresh, setMinutesSinceRefresh] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [tokenRes, healthRes] = await Promise.all([
      fetchDisplayAnalytics(branchId),
      fetchTvDisplayAnalytics(branchId),
    ])
    if (tokenRes.data) {
      setActiveDisplay(tokenRes.data.activeDisplayTokens)
      setActiveKiosk(tokenRes.data.activeKioskTokens)
      setLastSession(tokenRes.data.lastKioskSessionAt)
      setCreated7d(tokenRes.data.displayTokensCreated7d)
    }
    if (healthRes.data) {
      setIsOnline(healthRes.data.isOnline)
      setLastRefreshAt(healthRes.data.lastRefreshAt)
      setMinutesSinceRefresh(healthRes.data.minutesSinceRefresh)
    }
    setLoading(false)
  }, [branchId])

  useEffect(() => {
    void load()
    const interval = setInterval(() => void load(), 60_000)
    return () => clearInterval(interval)
  }, [load])

  const lastSessionLabel = lastSession
    ? new Date(lastSession).toLocaleString(locale, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Manila",
      })
    : t("display.never", "Never")

  const lastRefreshLabel =
    lastRefreshAt != null
      ? new Date(lastRefreshAt).toLocaleString(locale, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Manila",
        })
      : t("display.never", "Never")

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-neutral-800">
        {t("display.analyticsTitle", "Kiosk & TV display")}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3">
          <p className="text-xs font-medium text-neutral-500">
            {t("display.activeTvLinks", "Active TV links")}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {loading ? "—" : activeDisplay}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3">
          <p className="text-xs font-medium text-neutral-500">
            {t("display.activeKioskLinks", "Active kiosk links")}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {loading ? "—" : activeKiosk}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3">
          <p className="text-xs font-medium text-neutral-500">
            {t("display.lastKioskSession", "Last kiosk session")}
          </p>
          <p className="mt-1 text-sm font-semibold text-neutral-900">
            {loading ? "—" : lastSessionLabel}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3">
          <p className="text-xs font-medium text-neutral-500">
            {t("display.tvLinksCreated7d", "TV links created (7d)")}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {loading ? "—" : created7d}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3">
          <p className="text-xs font-medium text-neutral-500">
            {t("display.healthStatus", "TV status")}
          </p>
          <p
            className={cn(
              "mt-1 flex items-center gap-1.5 text-sm font-semibold",
              loading
                ? "text-neutral-400"
                : isOnline
                  ? "text-emerald-700"
                  : "text-amber-700"
            )}
          >
            {loading ? (
              "—"
            ) : isOnline ? (
              <>
                <Wifi className="h-3.5 w-3.5" aria-hidden />
                {t("display.healthOnline", "Online")}
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5" aria-hidden />
                {t("display.healthOffline", "No recent ping")}
              </>
            )}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3">
          <p className="text-xs font-medium text-neutral-500">
            {t("display.lastRefresh", "TV last refresh")}
          </p>
          <p className="mt-1 text-sm font-semibold text-neutral-900">
            {loading ? "—" : lastRefreshLabel}
          </p>
          {!loading && minutesSinceRefresh != null ? (
            <p className="mt-0.5 text-[11px] text-neutral-500">
              {t("display.minutesAgo", "{n} min ago").replace("{n}", String(minutesSinceRefresh))}
            </p>
          ) : null}
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-neutral-500">
        <Monitor className="h-3.5 w-3.5" aria-hidden />
        {t(
          "display.uptimeHint",
          "TV uptime is tracked via anonymous heartbeats — no patient data is stored."
        )}
      </p>
    </div>
  )
}
