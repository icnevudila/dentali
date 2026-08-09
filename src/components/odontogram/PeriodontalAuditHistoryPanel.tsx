"use client"

import * as React from "react"
import { History, RotateCcw } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { useLocale } from "@/hooks/use-locale"
import { countPerioAlerts } from "@/lib/odontogram/periodontal-types"
import {
  listPeriodontalAuditHistory,
  restorePatientPeriodontal,
  type PeriodontalAuditEvent,
  type PeriodontalPayload,
} from "@/lib/odontogram/periodontal-service"

export function PeriodontalAuditHistoryPanel({
  patientId,
  branchId,
  organizationId,
  actorUserId,
  canWrite = false,
  onRestored,
}: {
  patientId: string
  branchId: string
  organizationId?: string | null
  actorUserId?: string | null
  canWrite?: boolean
  onRestored?: (payload: PeriodontalPayload) => void
}) {
  const { t, locale } = useLocale()
  const [events, setEvents] = React.useState<PeriodontalAuditEvent[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<"load" | "restore" | "rpc" | null>(null)
  const [restoringId, setRestoringId] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)

  const dateLocale = locale === "tr" ? "tr-PH" : locale === "fil" ? "fil-PH" : "en-PH"

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void listPeriodontalAuditHistory({ patientId, branchId, limit: 25 }).then(
      ({ data, error: err }) => {
        if (cancelled) return
        if (err) {
          setError("load")
          setEvents([])
        } else {
          setEvents(data)
        }
        setLoading(false)
      }
    )
    return () => {
      cancelled = true
    }
  }, [patientId, branchId, reloadKey])

  const handleRestore = async (eventId: string) => {
    if (!canWrite || !organizationId || !actorUserId) return
    setRestoringId(eventId)
    setError(null)
    const { data, error: err } = await restorePatientPeriodontal({
      patientId,
      branchId,
      organizationId,
      actorUserId,
      auditEventId: eventId,
    })
    setRestoringId(null)
    if (err === "restore_rpc_unavailable") {
      setError("rpc")
      return
    }
    if (err || !data) {
      setError("restore")
      return
    }
    onRestored?.(data)
    setReloadKey((n) => n + 1)
  }

  return (
    <Card data-testid="periodontal-audit-history">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4 text-neutral-500" />
          {t("patients.perioAuditTitle", "Periodontal history")}
        </CardTitle>
        <CardDescription>
          {t(
            "patients.perioAuditDescription",
            "Previous saved snapshots from chart audit. Restore replaces the current probing chart."
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? <PageLoadingSkeleton variant="borderedList" className="py-2" /> : null}

        {error === "load" ? (
          <div className="space-y-2">
            <p className="text-xs text-amber-800" role="alert">
              {t(
                "patients.perioAuditLoadError",
                "Could not load periodontal history. Try again."
              )}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setReloadKey((n) => n + 1)}
            >
              {t("common.retry", "Retry")}
            </Button>
          </div>
        ) : null}

        {error === "restore" ? (
          <p className="text-xs text-amber-800" role="alert">
            {t(
              "patients.perioAuditRestoreError",
              "Restore failed. Check write permission and try again."
            )}
          </p>
        ) : null}

        {error === "rpc" ? (
          <p className="text-xs text-amber-800" role="alert">
            {t(
              "patients.perioAuditRpcMissing",
              "Restore is not available until the clinic database migration is applied."
            )}
          </p>
        ) : null}

        {!loading && !error && events.length === 0 ? (
          <EmptyState
            icon={History}
            title={t("patients.perioAuditEmptyTitle", "No periodontal snapshots yet")}
            description={t(
              "patients.perioAuditEmptyDescription",
              "Saved probing changes appear here after the first sync to the dental chart."
            )}
            className="py-6"
          />
        ) : null}

        {!loading && events.length > 0 ? (
          <ul className="divide-y divide-neutral-100 rounded-md border border-neutral-200">
            {events.map((ev) => {
              const alerts = countPerioAlerts(ev.snapshot)
              const when = new Date(ev.created_at).toLocaleString(dateLocale, {
                timeZone: "Asia/Manila",
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
              const actionLabel =
                ev.action === "RESTORE"
                  ? t("patients.perioAuditActionRestore", "Restored")
                  : ev.action === "INSERT"
                    ? t("patients.perioAuditActionInsert", "Created")
                    : t("patients.perioAuditActionUpdate", "Updated")

              return (
                <li
                  key={ev.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-xs"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-medium text-neutral-800">
                      {actionLabel}
                      <span className="mx-1 text-neutral-300">·</span>
                      <time dateTime={ev.created_at}>{when}</time>
                    </p>
                    <p className="text-neutral-500">
                      {ev.actor_name ?? t("patients.perioAuditSystemActor", "System")}
                      <span className="mx-1">·</span>
                      {t("patients.perioAuditTeethCount", "{count} teeth recorded").replace(
                        "{count}",
                        String(alerts.teethRecorded)
                      )}
                      {alerts.pockets4Plus > 0
                        ? ` · ≥4mm: ${alerts.pockets4Plus}`
                        : null}
                    </p>
                  </div>
                  {canWrite ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 shrink-0 gap-1 text-xs"
                      disabled={restoringId != null || !organizationId || !actorUserId}
                      onClick={() => void handleRestore(ev.id)}
                    >
                      <RotateCcw className="h-3 w-3" />
                      {restoringId === ev.id
                        ? t("patients.perioAuditRestoring", "Restoring…")
                        : t("patients.perioAuditRestore", "Restore")}
                    </Button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  )
}
