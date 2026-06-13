"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ChevronDown, ChevronUp, History, ScrollText } from "lucide-react"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { fetchEntityAuditTrail, type AuditLogRecord } from "@/lib/audit/audit-log-service"
import { useLocale } from "@/hooks/use-locale"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type AuditHistoryPanelProps = {
  entityType: string
  entityId: string
  className?: string
  defaultOpen?: boolean
}

export function AuditHistoryPanel({
  entityType,
  entityId,
  className,
  defaultOpen = false,
}: AuditHistoryPanelProps) {
  const { t } = useLocale()
  const [open, setOpen] = useState(defaultOpen)
  const [logs, setLogs] = useState<AuditLogRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await fetchEntityAuditTrail({
      entityType,
      entityId,
      limit: 25,
    })
    setLogs(data)
    setError(err)
    setLoading(false)
    setLoaded(true)
  }, [entityType, entityId])

  useEffect(() => {
    if (open && !loaded) {
      void load()
    }
  }, [open, loaded, load])

  return (
    <PermissionGate permission={PERMISSIONS.AUDIT_READ}>
      <div
        className={cn(
          "rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]",
          className
        )}
      >
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <History className="h-4 w-4 text-primary-600" aria-hidden />
            {t("audit.historyTitle", "Activity history")}
          </span>
          {open ? (
            <ChevronUp className="h-4 w-4 text-neutral-400" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4 text-neutral-400" aria-hidden />
          )}
        </button>

        {open ? (
          <div className="border-t border-neutral-100 px-4 py-3">
            {loading ? (
              <p className="text-sm text-neutral-500">{t("common.loading", "Loading…")}</p>
            ) : error ? (
              <div className="space-y-2">
                <p className="text-sm text-red-600">{error}</p>
                <Button variant="outline" size="sm" onClick={() => void load()}>
                  {t("common.retry", "Retry")}
                </Button>
              </div>
            ) : logs.length === 0 ? (
              <p className="text-sm text-neutral-500">
                {t("audit.emptyEntity", "No audit events for this record yet.")}
              </p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {logs.map((log) => (
                  <li key={`${log.source}-${log.id}`} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-medium text-neutral-900">{log.action}</p>
                      <time className="text-xs tabular-nums text-neutral-400">
                        {new Date(log.created_at).toLocaleString()}
                      </time>
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {log.actor_name ?? "—"}
                      {log.source === "session" && log.ip_address ? ` · ${log.ip_address}` : null}
                    </p>
                    {Object.keys(log.metadata ?? {}).length > 0 ? (
                      <p className="mt-1 truncate text-xs text-neutral-400">
                        {JSON.stringify(log.metadata)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 flex justify-end">
              <Button variant="ghost" size="sm" asChild className="gap-1.5 text-primary-600">
                <Link href="/settings/audit">
                  <ScrollText className="h-3.5 w-3.5" />
                  {t("audit.viewAll", "Full audit log")}
                </Link>
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </PermissionGate>
  )
}
