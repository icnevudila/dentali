"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import {
  downloadAuditCsv,
  fetchUnifiedAuditTrail,
  type AuditLogRecord,
  type AuditSource,
} from "@/lib/audit/audit-log-service"
import { auditPeriodToSince, type AuditPeriod } from "@/lib/audit/audit-filters"
import { useBranch } from "@/hooks/use-branch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Download, RefreshCw, ScrollText, Search, Shield } from "lucide-react"
import { useLocale } from "@/hooks/use-locale"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ReportDrillLink } from "@/components/reports/ReportDrillLink"
import {
  formatAuditActionLabel,
  formatAuditDetailsLabel,
} from "@/lib/audit/audit-labels"

const SOURCE_TABS: { key: AuditSource; labelKey: string; fallback: string }[] = [
  { key: "all", labelKey: "settings.auditSourceAll", fallback: "All" },
  { key: "organization", labelKey: "settings.auditSourceOrg", fallback: "Organization" },
  { key: "session", labelKey: "settings.auditSourceSession", fallback: "Session" },
]

const PERIOD_TABS: { key: AuditPeriod; labelKey: string; fallback: string }[] = [
  { key: "today", labelKey: "settings.auditPeriodToday", fallback: "Today" },
  { key: "7d", labelKey: "settings.auditPeriod7d", fallback: "7 days" },
  { key: "30d", labelKey: "settings.auditPeriod30d", fallback: "30 days" },
  { key: "all", labelKey: "settings.auditPeriodAll", fallback: "All time" },
]

export default function AuditLogPage() {
  const { activeBranch } = useBranch()
  const { t } = useLocale()
  const searchParams = useSearchParams()
  const initialSource = searchParams?.get("source")
  const [source, setSource] = useState<AuditSource>(
    initialSource === "session" || initialSource === "organization" ? initialSource : "all"
  )
  const [branchOnly, setBranchOnly] = useState(false)
  const [period, setPeriod] = useState<AuditPeriod>("7d")
  const [actionSearch, setActionSearch] = useState("")
  const [actorSearch, setActorSearch] = useState("")
  const [entityType, setEntityType] = useState("")
  const [debouncedAction, setDebouncedAction] = useState("")
  const [debouncedActor, setDebouncedActor] = useState("")
  const [debouncedEntity, setDebouncedEntity] = useState("")
  const [logs, setLogs] = useState<AuditLogRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedAction(actionSearch)
      setDebouncedActor(actorSearch)
      setDebouncedEntity(entityType)
    }, 350)
    return () => clearTimeout(id)
  }, [actionSearch, actorSearch, entityType])

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await fetchUnifiedAuditTrail({
      branchId: branchOnly && activeBranch ? activeBranch.id : null,
      source,
      limit: 200,
      since: auditPeriodToSince(period),
      actionContains: debouncedAction,
      actorContains: debouncedActor,
      entityType: debouncedEntity,
    })
    setLogs(data)
    setError(err)
    setLoading(false)
  }, [branchOnly, activeBranch, source, period, debouncedAction, debouncedActor, debouncedEntity])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <PermissionGate permission={PERMISSIONS.AUDIT_READ}>
      <ModulePageShell
        maxWidth=""
        className="w-full"
        eyebrow={t("settings.auditEyebrow", "Compliance") + " · " + t("settings.auditTitle", "Audit Log")}
        icon={ScrollText}
        title={t("settings.auditTitle", "Audit Log")}
        description={t("settings.auditSubtitle", "Unified organization and session activity trail.")}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={logs.length === 0}
              onClick={() => downloadAuditCsv(logs, "audit-trail.csv", t)}
            >
              <Download className="h-4 w-4" />
              {t("settings.exportCsv", "Export CSV")}
            </Button>
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <Link href="/reports/compliance">
                <Shield className="h-4 w-4" />
                {t("compliance.title", "Sterilization log")}
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" />
              {t("settings.refresh", "Refresh")}
            </Button>
          </div>
        }
        badges={
          activeBranch ? (
            <div className="flex flex-wrap items-center gap-2 animate-fade-rise">
              <Badge variant={branchOnly ? "info" : "outline"} className="font-normal">
                {branchOnly ? activeBranch.name : t("settings.auditAllBranches", "All branches")}
              </Badge>
              <Badge variant="outline" className="font-normal capitalize">
                {source}
              </Badge>
            </div>
          ) : null
        }
        metrics={[
          {
            label: t("settings.metricEvents", "Events"),
            value: loading ? "—" : logs.length,
            hint: t("settings.metricEventsHintFiltered", "Matching filters (max 200)"),
            icon: ScrollText,
          },
        ]}
        metricsClassName="lg:grid-cols-1"
        error={error}
        onRetry={() => void load()}
        retryLabel={t("common.retry", "Retry")}
        panel={false}
      >
        <div className="space-y-4">
          <ReportDrillLink
            title={t("audit.reportsTitle", "Audit activity analytics")}
            description={t(
              "audit.reportsDescription",
              "Volume and pattern trends for sensitive actions are in Reports compliance."
            )}
            href="/reports#compliance"
            linkLabel={t("audit.openReports", "Open audit reports")}
          />

          <div className="flex flex-wrap gap-2">
            {SOURCE_TABS.map((tab) => (
              <Button
                key={tab.key}
                size="sm"
                variant={source === tab.key ? "default" : "outline"}
                onClick={() => setSource(tab.key)}
              >
                {t(tab.labelKey, tab.fallback)}
              </Button>
            ))}
            {activeBranch ? (
              <Button
                size="sm"
                variant={branchOnly ? "default" : "outline"}
                onClick={() => setBranchOnly((v) => !v)}
              >
                {branchOnly
                  ? t("settings.auditBranchOnly", "{name} only").replace("{name}", activeBranch.name)
                  : t("settings.auditAllBranches", "All branches")}
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {PERIOD_TABS.map((tab) => (
              <Button
                key={tab.key}
                size="sm"
                variant={period === tab.key ? "default" : "outline"}
                onClick={() => setPeriod(tab.key)}
              >
                {t(tab.labelKey, tab.fallback)}
              </Button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                className="pl-9"
                placeholder={t("settings.auditSearchAction", "Filter by action…")}
                value={actionSearch}
                onChange={(e) => setActionSearch(e.target.value)}
              />
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                className="pl-9"
                placeholder={t("settings.auditSearchActor", "Filter by actor…")}
                value={actorSearch}
                onChange={(e) => setActorSearch(e.target.value)}
              />
            </div>
            <Input
              placeholder={t("settings.auditSearchEntity", "Entity type (e.g. patient)")}
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <PageLoadingSkeleton variant="inline" />
        ) : logs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-neutral-500">
              {t("settings.auditEmpty", "No audit events match your filters.")}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-neutral-50 text-neutral-500">
                    <th className="px-4 py-3 text-left">{t("settings.auditColTime", "Time")}</th>
                    <th className="px-4 py-3 text-left">{t("settings.auditColSource", "Source")}</th>
                    <th className="px-4 py-3 text-left">{t("settings.auditColAction", "Action")}</th>
                    <th className="px-4 py-3 text-left">{t("settings.auditColActor", "Actor")}</th>
                    <th className="px-4 py-3 text-left">{t("settings.auditColEntity", "Entity")}</th>
                    <th className="px-4 py-3 text-left">{t("settings.auditColDetails", "Details")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs">
                  {logs.map((log) => (
                    <tr key={`${log.source}-${log.id}`} className={cn("hover:bg-neutral-50")}>
                      <td className="whitespace-nowrap px-4 py-3 font-mono">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 capitalize">{log.source}</td>
                      <td className="px-4 py-3 font-medium text-neutral-800">{formatAuditActionLabel(log.action, t)}</td>
                      <td className="px-4 py-3">{log.actor_name ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-neutral-600">
                        {log.entity_type ?? "—"}
                        {log.entity_id ? ` · ${log.entity_id.slice(0, 8)}` : ""}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-neutral-500" title={formatAuditDetailsLabel(log, t)}>
                        {formatAuditDetailsLabel(log, t)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </ModulePageShell>
    </PermissionGate>
  )
}
