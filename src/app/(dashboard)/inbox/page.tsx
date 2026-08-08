"use client"

import * as React from "react"
import Link from "next/link"
import { Inbox, MessageCircle, RefreshCw } from "lucide-react"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { useDashboardStats } from "@/hooks/use-dashboard-stats"
import { useReportsSummary } from "@/hooks/use-reports-summary"
import { useAttentionContext } from "@/hooks/use-attention-context"
import { AutomationInbox } from "@/components/dashboard/AutomationInbox"
import { AttentionPanel } from "@/components/dashboard/AttentionPanel"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import {
  fetchNotificationLogs,
  type NotificationLog,
} from "@/lib/notifications/notification-service"
import { countInboxFollowUps } from "@/lib/dashboard/inbox-counts"
import { DirectionalTransition } from "@/components/layout/DirectionalTransition"

export default function InboxPage() {
  const { activeBranch } = useBranch()
  const { t, locale } = useLocale()
  const { stats, loading, error, reload } = useDashboardStats()
  const { summary: reportsSummary, loading: reportsLoading } = useReportsSummary(7, locale)
  const { permissions, workflowSettings } = useAttentionContext()
  const [logs, setLogs] = React.useState<NotificationLog[]>([])
  const [logsLoading, setLogsLoading] = React.useState(true)
  const [logsError, setLogsError] = React.useState<string | null>(null)

  const noShows = reportsSummary?.totals.noShow ?? 0
  const followUpCount = countInboxFollowUps(stats, noShows)

  const loadLogs = React.useCallback(async () => {
    if (!activeBranch) {
      setLogs([])
      setLogsLoading(false)
      return
    }
    setLogsLoading(true)
    const res = await fetchNotificationLogs(activeBranch.id, 30)
    setLogs(res.data)
    setLogsError(res.error)
    setLogsLoading(false)
  }, [activeBranch])

  React.useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  return (
    <PermissionGate
      anyOf={[
        PERMISSIONS.QUEUE_MANAGE,
        PERMISSIONS.APPOINTMENTS_READ,
        PERMISSIONS.BILLING_READ,
        PERMISSIONS.PATIENTS_READ,
      ]}
    >
      <DirectionalTransition>
        <ModulePageShell
          eyebrow={t("inbox.pageEyebrow", "Front desk")}
          icon={Inbox}
          title={t("inbox.pageTitle", "Inbox")}
          description={t(
            "inbox.pageDescription",
            "Follow-ups, attention items, and recent patient outreach in one place."
          )}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {followUpCount > 0 ? (
                <Badge variant="warning" className="tabular-nums">
                  {followUpCount} {t("inbox.needsAction", "need action")}
                </Badge>
              ) : (
                <Badge variant="success">{t("inbox.allClear", "All clear")}</Badge>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  void reload()
                  void loadLogs()
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                {t("common.refresh", "Refresh")}
              </Button>
            </div>
          }
        >
          {!activeBranch ? (
            <p className="text-sm text-neutral-500">
              {t("dashboard.selectBranch", "Select a branch to view stats")}
            </p>
          ) : loading && reportsLoading ? (
            <PageLoadingSkeleton variant="cards" />
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50/80 p-4">
              <p className="text-sm text-red-700">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => void reload()}>
                {t("common.retry", "Retry")}
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-2">
              <AutomationInbox
                stats={stats}
                reportsSummary={reportsSummary}
                loading={loading || reportsLoading}
              />

              <AttentionPanel
                stats={stats}
                permissions={permissions}
                workflowSettings={workflowSettings}
                labels={{
                  title: t("dashboard.needsAttention", "Needs attention"),
                  allClear: t("dashboard.attentionClear", "Nothing urgent right now"),
                  allClearCta: t("inbox.ctaQueue", "Queue"),
                  allClearHref: "/queue",
                  pendingConsents: t("dashboard.attnConsents", "Pending consents"),
                  pendingIntakeDrafts: t("dashboard.attnIntake", "Pending intake drafts"),
                  appointmentsAwaitingCheckin: t(
                    "dashboard.attnCheckin",
                    "Appointments awaiting check-in"
                  ),
                  queueWaiting: t("dashboard.attnQueue", "Patients waiting in queue"),
                  waitlistWaiting: t("dashboard.attnWaitlist", "Waitlist entries"),
                  openInvoices: t("dashboard.attnInvoices", "Open invoices"),
                  lowStock: t("dashboard.attnStock", "Low stock items"),
                  missingNotes: t("dashboard.attnNotes", "Missing clinical notes"),
                  overdueInvoices: t("dashboard.attnOverdue", "Overdue invoices"),
                  hmoDraft: t("dashboard.attnHmo", "HMO draft claims"),
                  philhealthPending: t("dashboard.attnPhilhealth", "PhilHealth pending"),
                  openEncountersStale: t("dashboard.attnStale", "Stale open visits"),
                  recareDue: t("dashboard.attnRecare", "Recare due"),
                }}
              />

              <Card className="xl:col-span-2">
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 pb-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <MessageCircle className="h-4 w-4 text-primary-600" aria-hidden />
                      {t("inbox.recentOutreach", "Recent outreach")}
                    </CardTitle>
                    <p className="mt-1 text-xs text-neutral-500">
                      {t(
                        "inbox.recentOutreachHint",
                        "SMS, WhatsApp opens, and test sends logged for this branch."
                      )}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/settings/notifications">
                      {t("inbox.openNotifications", "Notification settings")}
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  {logsLoading ? (
                    <p className="text-sm text-neutral-500">{t("common.loading", "Loading…")}</p>
                  ) : logsError ? (
                    <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 text-center">
                      <p className="text-sm text-red-700">{logsError}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => void loadLogs()}
                      >
                        {t("common.retry", "Retry")}
                      </Button>
                    </div>
                  ) : logs.length === 0 ? (
                    <EmptyState
                      icon={Inbox}
                      className="border-dashed bg-neutral-50/60 py-8"
                      title={t("inbox.noOutreachTitle", "No outreach logged yet")}
                      description={t(
                        "inbox.noOutreachYet",
                        "Open a patient profile and use WhatsApp, or send from Notification settings."
                      )}
                      action={
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <Button asChild size="sm">
                            <Link href="/patients">{t("inbox.ctaPatients", "Patients")}</Link>
                          </Button>
                          <Button asChild size="sm" variant="outline">
                            <Link href="/queue">{t("inbox.ctaQueue", "Queue")}</Link>
                          </Button>
                          <Button asChild size="sm" variant="outline">
                            <Link href="/settings/notifications">
                              {t("inbox.ctaNotifications", "Notifications")}
                            </Link>
                          </Button>
                        </div>
                      }
                    />
                  ) : (
                    <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
                      {logs.map((log) => (
                        <li
                          key={log.id}
                          className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-neutral-900">
                              {log.template_key ?? t("inbox.manualOutreach", "Manual outreach")}
                            </p>
                            <p className="truncate text-xs text-neutral-500">{log.body_preview}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 text-xs text-neutral-500">
                            <span className="tabular-nums">{log.recipient_phone ?? "—"}</span>
                            <Badge variant="outline" className="capitalize">
                              {log.status}
                            </Badge>
                            <span className="tabular-nums">
                              {new Date(log.created_at).toLocaleString("en-PH", {
                                timeZone: "Asia/Manila",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </ModulePageShell>
      </DirectionalTransition>
    </PermissionGate>
  )
}
