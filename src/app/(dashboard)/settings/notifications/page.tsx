"use client"

import * as React from "react"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useBranch } from "@/hooks/use-branch"
import { usePermission } from "@/hooks/use-permission"
import {
  deleteBranchNotificationOverride,
  fetchEffectiveNotificationTemplates,
  fetchNotificationLogs,
  fetchNotificationStatus,
  logManualWhatsAppNotification,
  maskPhone,
  renderPreview,
  sendSms,
  sendTestNotification,
  upsertBranchNotificationTemplate,
  updateNotificationTemplate,
  TEMPLATE_VARIABLES,
  type EffectiveNotificationTemplate,
  type NotificationLog,
} from "@/lib/notifications/notification-service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { AlertTriangle, MessageSquare, RotateCcw, Send } from "lucide-react"
import { useLocale } from "@/hooks/use-locale"
import { SmsPreviewBubble, VariableChips } from "@/components/notifications/SmsPreviewBubble"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { MapPin } from "lucide-react"
import { ReportDrillLink } from "@/components/reports/ReportDrillLink"
import { WorkflowSettingsLink } from "@/components/layout/WorkflowSettingsLink"
import { buildWhatsAppSendUrl } from "@/lib/notifications/whatsapp"

const SAMPLE_VARS: Record<string, string> = {
  patient_name: "Maria Santos",
  clinic_name: "Smile Dental QC",
  appointment_date: "June 10, 2026",
  appointment_time: "2:30 PM",
  slot_date: "June 10, 2026",
  slot_time: "2:30 PM",
  amount: "₱1,500",
  queue_code: "Q003",
  booking_link: "https://ph-dental-app.vercel.app/welcome?utm=recall",
  last_visit_date: "December 10, 2025",
  date: "June 12, 2026",
  collected: "₱45,200",
  open_balance: "₱12,800",
  appointments_completed: "18",
  no_show: "2",
}

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "danger" | "info" | "outline"> = {
  dry_run: "warning",
  queued: "info",
  sent: "success",
  delivered: "success",
  failed: "danger",
}

export default function NotificationsSettingsPage() {
  const { activeBranch } = useBranch()
  const { hasPermission } = usePermission()
  const { t } = useLocale()
  const canWrite = hasPermission(PERMISSIONS.NOTIFICATIONS_WRITE)
  const canEditOrg = hasPermission(PERMISSIONS.SETTINGS_MANAGE)

  const [templates, setTemplates] = React.useState<EffectiveNotificationTemplate[]>([])
  const [logs, setLogs] = React.useState<NotificationLog[]>([])
  const [status, setStatus] = React.useState<Awaited<ReturnType<typeof fetchNotificationStatus>>["data"]>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null)
  const [editBody, setEditBody] = React.useState("")
  const [orgEditBody, setOrgEditBody] = React.useState("")
  const [templateScope, setTemplateScope] = React.useState<"branch" | "org">("branch")
  const [saving, setSaving] = React.useState(false)
  const [resetting, setResetting] = React.useState(false)
  const [testPhone, setTestPhone] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const [openingWhatsApp, setOpeningWhatsApp] = React.useState(false)
  const [tab, setTab] = React.useState<"templates" | "logs">("templates")

  const selected = templates.find((tpl) => tpl.template_key === selectedKey) ?? templates[0]

  const load = React.useCallback(async () => {
    if (!activeBranch) return
    setLoading(true)

    const [tplRes, logRes, statusRes] = await Promise.all([
      fetchEffectiveNotificationTemplates(activeBranch.id),
      fetchNotificationLogs(activeBranch.id),
      fetchNotificationStatus(activeBranch.id),
    ])

    setTemplates(tplRes.data)
    setLogs(logRes.data)
    setStatus(statusRes.data)
    setError(tplRes.error ?? logRes.error ?? statusRes.error)
    if (!selectedKey && tplRes.data.length > 0) {
      setSelectedKey(tplRes.data[0].template_key)
      setEditBody(tplRes.data[0].effective_body)
      setOrgEditBody(tplRes.data[0].org_default_body)
    }
    setLoading(false)
  }, [activeBranch, selectedKey])

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      load()
    }, 0)
    return () => window.clearTimeout(id)
  }, [load])

  React.useEffect(() => {
    if (selected) {
      const id = window.setTimeout(() => {
        setEditBody(selected.effective_body)
        setOrgEditBody(selected.org_default_body)
      }, 0)
      return () => window.clearTimeout(id)
    }
    return undefined
  }, [selected])

  const handleSave = async () => {
    if (!selected || !activeBranch || !canWrite) return
    setSaving(true)
    const { error: err } =
      templateScope === "org" && canEditOrg
        ? await updateNotificationTemplate(selected.org_template_id, { body: orgEditBody })
        : await upsertBranchNotificationTemplate({
            branchId: activeBranch.id,
            templateKey: selected.template_key,
            body: editBody,
          })
    setSaving(false)
    if (err) setError(err)
    else load()
  }

  const handleReset = async () => {
    if (!selected || !activeBranch || !canWrite || !selected.is_branch_override) return
    setResetting(true)
    const { error: err } = await deleteBranchNotificationOverride(activeBranch.id, selected.template_key)
    setResetting(false)
    if (err) setError(err)
    else load()
  }

  const handleToggleDryRun = async () => {
    if (!activeBranch || !canWrite || status == null) return
    const { upsertDryRunMode } = await import("@/lib/notifications/notification-service")
    const { fetchOrganization } = await import("@/lib/auth/auth-service")
    const org = await fetchOrganization()
    if (!org) return
    const { error: err } = await upsertDryRunMode(activeBranch.id, org.id, !status.dry_run_mode)
    if (err) setError(err)
    else load()
  }

  const handleTestSend = async () => {
    if (!selected || !activeBranch || !testPhone.trim()) return
    setSending(true)
    const vars: Record<string, string> = {}
    for (const key of TEMPLATE_VARIABLES[selected.template_key] ?? []) {
      vars[key] = SAMPLE_VARS[key] ?? key
    }
    const renderedBody = renderPreview(selected.effective_body, vars)

    if (status?.dry_run_mode) {
      const { error: err } = await sendTestNotification(
        selected.effective_id,
        testPhone.trim(),
        vars,
        activeBranch.id
      )
      setSending(false)
      if (err) setError(err)
      else {
        setTab("logs")
        load()
      }
      return
    }

    const { error: err } = await sendSms({
      phone: testPhone.trim(),
      body: renderedBody,
      branchId: activeBranch.id,
      templateKey: selected.template_key,
    })
    setSending(false)
    if (err) setError(err)
    else {
      setTab("logs")
      load()
    }
  }

  const handleOpenWhatsApp = async () => {
    if (!selected || !activeBranch || !testPhone.trim() || !whatsAppHref) return
    setOpeningWhatsApp(true)
    const opened = window.open(whatsAppHref, "_blank", "noopener,noreferrer")
    const { error: err } = await logManualWhatsAppNotification({
      phone: testPhone.trim(),
      body: preview,
      branchId: activeBranch.id,
      templateKey: selected.template_key,
    })
    setOpeningWhatsApp(false)
    if (err) {
      setError(err)
    } else {
      setTab("logs")
      load()
    }
    if (!opened) {
      setError(t("settings.notificationsPopupBlocked", "WhatsApp popup was blocked by the browser."))
    }
  }

  const preview = selected
    ? renderPreview(templateScope === "org" && canEditOrg ? orgEditBody : editBody, SAMPLE_VARS)
    : ""
  const whatsAppHref = testPhone.trim() ? buildWhatsAppSendUrl(testPhone.trim(), preview) : null
  const isDirty =
    templateScope === "org" && canEditOrg
      ? selected
        ? orgEditBody !== selected.org_default_body
        : false
      : selected
        ? editBody !== selected.effective_body
        : false

  return (
    <PermissionGate permission={PERMISSIONS.NOTIFICATIONS_READ}>
      <ModulePageShell
        maxWidth=""
        className="w-full"
        eyebrow={t("settings.notificationsEyebrow", "Messaging") + " · SMS"}
        icon={MessageSquare}
        title={t("settings.notificationsTitle", "Notifications & SMS")}
        description={t(
          "settings.notificationsBranchHint",
          "Branch templates override org defaults for this location."
        )}
        actions={
          <div className="flex flex-wrap gap-2">
            <WorkflowSettingsLink />
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {t("common.refresh", "Refresh")}
            </Button>
          </div>
        }
        badges={
          activeBranch ? (
            <div className="flex flex-wrap items-center gap-2 animate-fade-rise">
              <Badge variant="info" className="gap-1 font-normal">
                <MapPin className="h-3 w-3" aria-hidden />
                {activeBranch.name}
              </Badge>
              {status?.dry_run_mode ? (
                <Badge variant="warning" className="font-normal">
                  {t("settings.dryRun", "Dry-run mode")}
                </Badge>
              ) : null}
            </div>
          ) : null
        }
        metrics={[
          {
            label: t("settings.metricTemplates", "Templates"),
            value: loading ? "—" : templates.length,
            hint: t("settings.metricSmsHint", "SMS message types"),
            icon: MessageSquare,
          },
          {
            label: t("settings.metricLogs", "Recent logs"),
            value: loading ? "—" : logs.length,
            hint: t("settings.metricLogsHint", "Delivery history"),
          },
        ]}
        metricsClassName="lg:grid-cols-2"
        error={error}
        onRetry={() => void load()}
        retryLabel={t("common.retry", "Retry")}
        panel={false}
      >
        {activeBranch ? (
          <ReportDrillLink
            title={t("settings.notificationsReportsTitle", "SMS delivery analytics")}
            description={t(
              "settings.notificationsReportsDescription",
              "Template usage and delivery health trends are in Reports compliance."
            )}
            href="/reports#compliance"
            linkLabel={t("settings.notificationsOpenReports", "Open messaging reports")}
          />
        ) : null}

        {status?.dry_run_mode && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{t("settings.notificationsDryRun", "Dry-run mode is ON")}</p>
              <p className="text-amber-800">
                {t("settings.notificationsDryRunHint", "Messages are logged but not sent to a real SMS provider yet.")}
              </p>
              {canWrite && (
                <Button variant="outline" size="sm" className="mt-2" onClick={handleToggleDryRun}>
                  {t("settings.notificationsDisableDryRun", "Disable dry-run")}
                </Button>
              )}
            </div>
          </div>
        )}

        {!status?.dry_run_mode && canWrite && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {t("settings.notificationsLiveMode", "Live send mode — test messages use the SMS provider.")}
            <Button variant="outline" size="sm" className="mt-2 ml-0 block" onClick={handleToggleDryRun}>
              {t("settings.notificationsEnableDryRun", "Re-enable dry-run")}
            </Button>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-neutral-500">{t("settings.notificationsSentToday", "Sent today")}</p>
              <p className="text-2xl font-bold">{status?.sent_today ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-neutral-500">{t("settings.notificationsDryRunToday", "Dry-run today")}</p>
              <p className="text-2xl font-bold">{status?.dry_run_today ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-neutral-500">{t("settings.notificationsFailedToday", "Failed today")}</p>
              <p className="text-2xl font-bold text-red-600">{status?.failed_today ?? 0}</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-2">
          <Button variant={tab === "templates" ? "default" : "outline"} size="sm" onClick={() => setTab("templates")}>
            {t("settings.notificationsTemplates", "Templates")}
          </Button>
          <Button variant={tab === "logs" ? "default" : "outline"} size="sm" onClick={() => setTab("logs")}>
            {t("settings.notificationsLogs", "Message logs")}
          </Button>
        </div>

        {loading ? (
          <PageLoadingSkeleton variant="inline" />
        ) : tab === "templates" ? (
          templates.length === 0 ? (
            <p className="text-neutral-500 text-center py-12">{t("settings.notificationsNoTemplates", "No templates yet.")}</p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("settings.notificationsTemplates", "Templates")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {templates.map((tpl) => (
                    <button
                      key={tpl.template_key}
                      type="button"
                      onClick={() => setSelectedKey(tpl.template_key)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm ${
                        selected?.template_key === tpl.template_key ? "bg-primary-50 text-primary-800" : "hover:bg-neutral-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{tpl.name}</span>
                        {tpl.is_branch_override ? (
                          <Badge variant="info" className="text-[10px]">
                            {t("settings.notificationsBranchOverride", "Branch override")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            {t("settings.notificationsOrgDefault", "Org default")}
                          </Badge>
                        )}
                      </div>
                      <span className="text-neutral-400 text-xs">{tpl.template_key}</span>
                    </button>
                  ))}
                </CardContent>
              </Card>

              {selected && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" /> {selected.name}
                    </CardTitle>
                    {canEditOrg ? (
                      <div className="mt-3 inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
                        <button
                          type="button"
                          onClick={() => setTemplateScope("branch")}
                          className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                            templateScope === "branch"
                              ? "bg-white text-neutral-900 shadow-sm"
                              : "text-neutral-500"
                          }`}
                        >
                          {t("settings.notificationsBranchOverride", "Branch override")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setTemplateScope("org")}
                          className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                            templateScope === "org"
                              ? "bg-white text-neutral-900 shadow-sm"
                              : "text-neutral-500"
                          }`}
                        >
                          {t("settings.notificationsOrgDefault", "Org default")}
                        </button>
                      </div>
                    ) : null}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-neutral-500">
                        {templateScope === "org" && canEditOrg
                          ? t("settings.notificationsOrgDefaultBody", "Organization default message")
                          : t("settings.notificationsMessageBody", "Message body for this branch")}
                      </label>
                      <textarea
                        className="mt-1 w-full min-h-[120px] rounded-md border border-neutral-200 px-3 py-2 text-sm font-mono"
                        value={templateScope === "org" && canEditOrg ? orgEditBody : editBody}
                        onChange={(e) =>
                          templateScope === "org" && canEditOrg
                            ? setOrgEditBody(e.target.value)
                            : setEditBody(e.target.value)
                        }
                        disabled={!canWrite || (templateScope === "org" && !canEditOrg)}
                      />
                      <VariableChips
                        className="mt-2"
                        variables={TEMPLATE_VARIABLES[selected.template_key] ?? []}
                        onInsert={
                          canWrite
                            ? (token) => {
                                if (templateScope === "org" && canEditOrg) {
                                  setOrgEditBody((prev) => (prev ? `${prev} ${token}` : token))
                                } else {
                                  setEditBody((prev) => (prev ? `${prev} ${token}` : token))
                                }
                              }
                            : undefined
                        }
                      />
                    </div>

                    <SmsPreviewBubble
                      body={preview}
                      label={t("settings.notificationsPreview", "Preview")}
                    />

                    {templateScope === "branch" ? (
                      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
                        <p className="mb-1 text-xs font-medium text-neutral-500">
                          {t("settings.notificationsOrgDefaultBody", "Org default")}
                        </p>
                        <p className="whitespace-pre-wrap text-neutral-600">{selected.org_default_body}</p>
                      </div>
                    ) : null}

                    {canWrite && (templateScope === "branch" || canEditOrg) && (
                      <>
                        <div className="flex flex-wrap gap-2">
                          <Button onClick={handleSave} disabled={saving || !isDirty}>
                            {saving
                              ? t("common.loading", "Saving…")
                              : templateScope === "org" && canEditOrg
                                ? t("settings.notificationsSaveOrg", "Save org default")
                                : t("settings.notificationsSaveBranch", "Save branch override")}
                          </Button>
                          {templateScope === "branch" && selected.is_branch_override && (
                            <Button variant="outline" className="gap-1" disabled={resetting} onClick={handleReset}>
                              <RotateCcw className="h-4 w-4" />
                              {t("settings.notificationsResetToOrg", "Reset to org default")}
                            </Button>
                          )}
                        </div>

                        <div className="border-t pt-4 space-y-2">
                          <p className="text-sm font-medium">{t("settings.notificationsSendTest", "Send test")}</p>
                          <div className="flex gap-2">
                            <Input
                              type="tel"
                              placeholder="09XX XXX XXXX"
                              value={testPhone}
                              onChange={(e) => setTestPhone(e.target.value)}
                            />
                            <Button className="gap-2 shrink-0" disabled={sending || !testPhone.trim()} onClick={handleTestSend}>
                              <Send className="h-4 w-4" /> {t("settings.notificationsTest", "Test")}
                            </Button>
                          </div>
                          <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                            <p className="font-medium text-neutral-800">
                              {t("settings.notificationsManualWhatsApp", "Manual WhatsApp option")}
                            </p>
                            <p className="mt-1">
                              {t(
                                "settings.notificationsManualWhatsAppHint",
                                "Opens the same preview in WhatsApp. No paid WhatsApp API is used; keep SMS dry-run on while testing templates."
                              )}
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2"
                              disabled={!whatsAppHref || openingWhatsApp}
                              onClick={() => void handleOpenWhatsApp()}
                            >
                              {openingWhatsApp
                                ? t("settings.notificationsLoggingWhatsApp", "Logging…")
                                : t("settings.notificationsOpenWhatsApp", "Open WhatsApp")}
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )
        ) : logs.length === 0 ? (
          <p className="text-center py-12 text-neutral-500">
            {t("settings.notificationsNoLogs", "No messages logged yet. Send a test from Templates.")}
          </p>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-neutral-500">
                    <th className="pb-3 text-left font-medium">{t("settings.notificationsTime", "Time")}</th>
                    <th className="pb-3 text-left font-medium">{t("settings.notificationsTemplateCol", "Template")}</th>
                    <th className="pb-3 text-left font-medium">{t("settings.notificationsTo", "To")}</th>
                    <th className="pb-3 text-left font-medium">{t("settings.notificationsStatus", "Status")}</th>
                    <th className="pb-3 text-left font-medium">{t("settings.notificationsPreview", "Preview")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-2 text-xs text-neutral-500 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("en-PH")}
                      </td>
                      <td className="py-2 text-xs">{log.template_key ?? "—"}</td>
                      <td className="py-2 font-mono text-xs">{maskPhone(log.recipient_phone)}</td>
                      <td className="py-2">
                        <Badge variant={STATUS_VARIANT[log.status] ?? "outline"}>{log.status}</Badge>
                      </td>
                      <td className="py-2 text-xs text-neutral-600 max-w-xs truncate">{log.body_preview}</td>
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
