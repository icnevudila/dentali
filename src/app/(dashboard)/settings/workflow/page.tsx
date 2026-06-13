"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Workflow } from "lucide-react"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import {
  fetchAutomationRunLog,
  fetchWorkflowSettings,
  updateWorkflowSettings,
  type AutomationLogEntry,
} from "@/lib/analytics/analytics-service"
import { fetchOwnerDigestReadiness, type OwnerDigestReadiness } from "@/lib/staff/staff-service"
import { ATTENTION_RULE_UI } from "@/lib/dashboard/attention-rules"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type WorkflowRule = {
  key: string
  label: string
  description: string
}

const WORKFLOW_GROUPS: { title: string; items: WorkflowRule[] }[] = [
  {
    title: "Queue & appointments",
    items: [
      {
        key: "auto_checkin_updates_appointment",
        label: "Check-in updates appointment",
        description: "When a patient is checked in from the queue, linked appointment moves to checked_in.",
      },
      {
        key: "auto_served_completes_appointment",
        label: "Served completes appointment",
        description: "Marking queue entry as served completes the linked appointment.",
      },
      {
        key: "consent_gate_checkin",
        label: "Consent gate on check-in",
        description: "Block check-in when required consents are unsigned; staff can override with audit.",
      },
      {
        key: "auto_waitlist_on_slot_open",
        label: "No-show opens waitlist slot",
        description: "Cancelled or no-show appointments notify matching waitlist entries.",
      },
    ],
  },
  {
    title: "Billing & claims",
    items: [
      {
        key: "auto_approve_creates_invoice",
        label: "Plan approval creates invoice draft",
        description: "Approved treatment plan automatically creates a draft invoice.",
      },
      {
        key: "auto_hmo_claim_on_invoice",
        label: "Invoice creates HMO claim draft",
        description: "Issued invoice with HMO coverage spawns a draft HMO claim.",
      },
      {
        key: "auto_payment_reminder",
        label: "Payment balance reminders",
        description: "Overdue balances enqueue SMS reminders via payment-reminder-cron.",
      },
    ],
  },
  {
    title: "Clinical inventory",
    items: [
      {
        key: "auto_deduct_procedure_bom",
        label: "Auto-deduct procedure BOM",
        description: "When queue entry is served, deduct linked inventory materials from approved treatment plan procedures.",
      },
    ],
  },
  {
    title: "Notifications",
    items: [
      {
        key: "auto_sms_reminders",
        label: "SMS appointment reminders",
        description: "T-24h and T-2h appointment reminders via appointment-reminders-cron.",
      },
      {
        key: "auto_hygiene_recall",
        label: "Hygiene recall SMS (6 months)",
        description: "Patients due for check-up receive SMS with booking link via recall-reminder-cron.",
      },
      {
        key: "auto_owner_digest_sms",
        label: "Owner daily digest SMS",
        description: "End-of-day branch summary SMS to owner/admin phones via owner-digest-sms-cron.",
      },
    ],
  },
]

export default function WorkflowSettingsPage() {
  const { activeBranch } = useBranch()
  const { t } = useLocale()
  const [settings, setSettings] = useState<Record<string, boolean> | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [automationLog, setAutomationLog] = useState<AutomationLogEntry[]>([])
  const [digestReadiness, setDigestReadiness] = useState<OwnerDigestReadiness | null>(null)

  const load = useCallback(async () => {
    if (!activeBranch) return
    setLoading(true)
    setError(null)
    const [settingsRes, logRes, digestRes] = await Promise.all([
      fetchWorkflowSettings(activeBranch.id),
      fetchAutomationRunLog(activeBranch.id, 40),
      fetchOwnerDigestReadiness(activeBranch.id),
    ])
    setSettings(settingsRes.data)
    setAutomationLog(logRes.data)
    setDigestReadiness(digestRes.data)
    setError(settingsRes.error ?? logRes.error ?? digestRes.error)
    setLoading(false)
  }, [activeBranch])

  useEffect(() => {
    void load()
  }, [load])

  const handleToggle = async (key: string, invertedDefault = false) => {
    if (!activeBranch || !settings) return
    const current = settings[key]
    const isOn = invertedDefault ? current !== false : Boolean(current)
    const next = !isOn
    setSavingKey(key)
    setError(null)
    const { error: err } = await updateWorkflowSettings(activeBranch.id, { [key]: next })
    setSavingKey(null)
    if (err) setError(err)
    else await load()
  }

  return (
    <PermissionGate permission={PERMISSIONS.SETTINGS_MANAGE}>
      <ModulePageShell
        icon={Workflow}
        eyebrow={t("settings.workflowEyebrow", "Automation")}
        title={t("settings.workflowTitle", "Workflow automation")}
        description={t(
          "settings.workflowSubtitle",
          "Branch-level automation rules. Toggle per branch; changes are audited."
        )}
        error={error}
        onRetry={() => void load()}
      >
        {!activeBranch ? (
          <p className="text-sm text-neutral-500">{t("dashboard.selectBranch", "Select a branch")}</p>
        ) : loading ? (
          <p className="text-sm text-neutral-400">{t("common.loading", "Loading…")}</p>
        ) : (
          <div className="space-y-6">
            {digestReadiness?.workflow_enabled && !digestReadiness.ready ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <p className="font-medium">Owner digest SMS needs a phone number</p>
                <p className="mt-1 text-xs text-amber-900/90">
                  {digestReadiness.missing_phone_count} owner/admin at this branch ha{" "}
                  {digestReadiness.missing_phone_count === 1 ? "s" : "ve"} no mobile on file.
                  Add numbers under{" "}
                  <Link href="/settings/staff" className="font-medium underline">
                    Settings → Staff
                  </Link>
                  .
                </p>
              </div>
            ) : null}

            {WORKFLOW_GROUPS.map((group) => (
              <section key={group.title} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {group.title}
                </h3>
                <ul className="divide-y rounded-xl border border-neutral-200/80 bg-white">
                  {group.items.map((item) => (
                    <li key={item.key} className="flex items-start justify-between gap-4 px-4 py-3">
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-sm font-medium text-neutral-900">{item.label}</p>
                        <p className="text-xs text-neutral-500">{item.description}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 shrink-0 px-2"
                        disabled={savingKey === item.key}
                        onClick={() => void handleToggle(item.key)}
                      >
                        <Badge variant={settings?.[item.key] !== false ? "success" : "outline"}>
                          {settings?.[item.key] !== false
                            ? t("common.on", "On")
                            : t("common.off", "Off")}
                        </Badge>
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {t("settings.attentionRulesTitle", "Dashboard — Needs attention")}
              </h3>
              <p className="text-xs text-neutral-500">
                {t(
                  "settings.attentionRulesHint",
                  "Toggle which KPI alerts appear on the owner dashboard for this branch."
                )}
              </p>
              <ul className="divide-y rounded-xl border border-neutral-200/80 bg-white">
                {ATTENTION_RULE_UI.map((item) => (
                  <li key={item.key} className="flex items-start justify-between gap-4 px-4 py-3">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-medium text-neutral-900">{item.label}</p>
                      <p className="text-xs text-neutral-500">{item.description}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 px-2"
                      disabled={savingKey === item.key}
                      onClick={() => void handleToggle(item.key, true)}
                    >
                      <Badge variant={settings?.[item.key] !== false ? "success" : "outline"}>
                        {settings?.[item.key] !== false
                          ? t("common.on", "On")
                          : t("common.off", "Off")}
                      </Badge>
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
            <p className="text-xs text-neutral-500">
              Cron schedules and secrets:{" "}
              <Link href="/settings/notifications" className="text-primary-600 hover:underline">
                Notifications
              </Link>
              {" · "}
              See <code className="text-[11px]">docs/SUPABASE_CRON_SETUP.md</code> in the repo for scheduler setup.
            </p>
          </div>
        )}

        {automationLog.length > 0 ? (
          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-semibold text-neutral-900">
              {t("settings.automationLog", "Recent automation events")}
            </h3>
            <ul className="max-h-72 divide-y overflow-y-auto rounded-xl border border-neutral-200/80 bg-white text-sm">
              {automationLog.map((entry) => (
                <li key={entry.id} className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-neutral-800">{entry.event_type}</span>
                    <span className="text-xs text-neutral-500">
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                  </div>
                  {entry.entity_type ? (
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {entry.entity_type}
                      {entry.entity_id ? ` · ${entry.entity_id.slice(0, 8)}` : ""}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </ModulePageShell>
    </PermissionGate>
  )
}
