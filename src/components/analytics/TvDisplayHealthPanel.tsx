"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Monitor, Radio } from "lucide-react"
import { fetchTvDisplayAnalytics } from "@/lib/analytics/analytics-service"
import { useLocale } from "@/hooks/use-locale"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type TvDisplayHealthPanelProps = {
  branchId: string
  className?: string
}

export function TvDisplayHealthPanel({ branchId, className }: TvDisplayHealthPanelProps) {
  const { t } = useLocale()
  const [loading, setLoading] = useState(true)
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null)
  const [minutesSinceRefresh, setMinutesSinceRefresh] = useState<number | null>(null)
  const [activeDisplays7d, setActiveDisplays7d] = useState(0)
  const [isOnline, setIsOnline] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await fetchTvDisplayAnalytics(branchId)
    if (data) {
      setLastRefreshAt(data.lastRefreshAt)
      setMinutesSinceRefresh(data.minutesSinceRefresh)
      setActiveDisplays7d(data.activeDisplays7d)
      setIsOnline(data.isOnline)
    }
    setLoading(false)
  }, [branchId])

  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), 60_000)
    return () => clearInterval(id)
  }, [load])

  const lastRefreshLabel = lastRefreshAt
    ? new Date(lastRefreshAt).toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Manila",
      })
    : t("display.never", "Never")

  const uptimeLabel =
    minutesSinceRefresh == null
      ? t("display.noHeartbeat", "No heartbeat yet")
      : minutesSinceRefresh < 60
        ? t("display.uptimeMinutes", "{n} min ago").replace("{n}", String(minutesSinceRefresh))
        : t("display.uptimeHours", "{n} hr ago").replace(
            "{n}",
            String(Math.floor(minutesSinceRefresh / 60))
          )

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-neutral-500" aria-hidden />
          <p className="text-sm font-medium text-neutral-800">
            {t("display.healthTitle", "TV queue display")}
          </p>
          {!loading ? (
            <Badge variant={isOnline ? "success" : "warning"} className="gap-1 font-normal">
              <Radio className="h-3 w-3" aria-hidden />
              {isOnline
                ? t("display.online", "Online")
                : t("display.offline", "Offline / stale")}
            </Badge>
          ) : null}
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/queue">{t("display.openQueue", "Open queue")}</Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <p className="text-xs font-medium text-neutral-500">
            {t("display.lastRefresh", "Last refresh")}
          </p>
          <p className="mt-1 text-sm font-semibold text-neutral-900">
            {loading ? "—" : lastRefreshLabel}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <p className="text-xs font-medium text-neutral-500">
            {t("display.sinceRefresh", "Since last ping")}
          </p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-neutral-900">
            {loading ? "—" : uptimeLabel}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <p className="text-xs font-medium text-neutral-500">
            {t("display.activeDisplays7d", "Active displays (7d)")}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
            {loading ? "—" : activeDisplays7d}
          </p>
        </div>
      </div>
    </section>
  )
}
