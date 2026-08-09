"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
  type WorkflowSettingsMap,
} from "@/lib/analytics/analytics-service"
import { fetchOwnerDigestReadiness, type OwnerDigestReadiness } from "@/lib/staff/staff-service"
import { fetchBranchSetting } from "@/lib/org/branch-context-service"
import { getWorkflowGroups } from "@/lib/settings/workflow-rules-ui"
import { ATTENTION_RULE_UI } from "@/lib/dashboard/attention-rules"
import {
  DEFAULT_RECARE_INTERVAL_MONTHS,
  HYGIENE_RECALL_MONTHS_KEY,
  MAX_RECARE_INTERVAL_MONTHS,
  MIN_RECARE_INTERVAL_MONTHS,
  parseRecareIntervalMonths,
  resolveRecareIntervalMonthsFromSettings,
} from "@/lib/recare/recare-interval"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

function isWorkflowToggleOn(value: unknown, invertedDefault = false): boolean {
  if (invertedDefault) return value !== false
  if (typeof value === "boolean") return value
  // Missing keys default to on for live automation toggles.
  return value === undefined || value === null ? true : Boolean(value)
}

export default function WorkflowSettingsPage() {
  const { activeBranch } = useBranch()
  const { t } = useLocale()
  const workflowGroups = useMemo(() => getWorkflowGroups(t), [t])
  const [settings, setSettings] = useState<WorkflowSettingsMap | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [automationLog, setAutomationLog] = useState<AutomationLogEntry[]>([])
  const [digestReadiness, setDigestReadiness] = useState<OwnerDigestReadiness | null>(null)
  const [googleReviewUrl, setGoogleReviewUrl] = useState<string | null>(null)
  const [recallMonthsDraft, setRecallMonthsDraft] = useState(
    String(DEFAULT_RECARE_INTERVAL_MONTHS)
  )

  const load = useCallback(async () => {
    if (!activeBranch) return
    setLoading(true)
    setError(null)
    const [settingsRes, logRes, digestRes, reviewRes] = await Promise.all([
      fetchWorkflowSettings(activeBranch.id),
      fetchAutomationRunLog(activeBranch.id, 40),
      fetchOwnerDigestReadiness(activeBranch.id),
      fetchBranchSetting(activeBranch.id, "google_review_url"),
    ])
    setSettings(settingsRes.data)
    setRecallMonthsDraft(
      String(resolveRecareIntervalMonthsFromSettings(settingsRes.data as Record<string, unknown>))
    )
    setAutomationLog(logRes.data)
    setDigestReadiness(digestRes.data)
    setGoogleReviewUrl(reviewRes.value?.trim() || null)
    setError(settingsRes.error ?? logRes.error ?? digestRes.error ?? reviewRes.error)
    setLoading(false)
  }, [activeBranch])

  useEffect(() => {
    void load()
  }, [load])

  const handleToggle = async (key: string, invertedDefault = false) => {
    if (!activeBranch || !settings) return
    const current = settings[key]
    const isOn = isWorkflowToggleOn(current, invertedDefault)
    const next = !isOn
    setSavingKey(key)
    setError(null)
    const { error: err } = await updateWorkflowSettings(activeBranch.id, { [key]: next })
    setSavingKey(null)
    if (err) {
      setError(err)
      toast.error(err)
    } else {
      toast.success(t("settings.workflowSaved", "Workflow setting updated"))
      await load()
    }
  }

  const handleSaveRecallMonths = async () => {
    if (!activeBranch) return
    const parsed = parseRecareIntervalMonths(recallMonthsDraft)
    if (parsed == null) {
      toast.error(
        t(
          "settings.wfHygieneRecallMonthsInvalid",
          "Enter a whole number between {min} and {max} months."
        )
          .replace("{min}", String(MIN_RECARE_INTERVAL_MONTHS))
          .replace("{max}", String(MAX_RECARE_INTERVAL_MONTHS))
      )
      return
    }
    setSavingKey(HYGIENE_RECALL_MONTHS_KEY)
    setError(null)
    const { error: err } = await updateWorkflowSettings(activeBranch.id, {
      [HYGIENE_RECALL_MONTHS_KEY]: parsed,
    })
    setSavingKey(null)
    if (err) {
      setError(err)
      toast.error(err)
    } else {
      toast.success(t("settings.workflowSaved", "Workflow setting updated"))
      await load()
    }
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
                <p className="font-medium">
                  {t("settings.wfDigestPhoneTitle", "Owner digest SMS needs a phone number")}
                </p>
                <p className="mt-1 text-xs text-amber-900/90">
                  {t(
                    "settings.wfDigestPhoneBody",
                    "{count} owner/admin at this branch {verb} no mobile on file. Add numbers under Settings → Staff."
                  )
                    .replace("{count}", String(digestReadiness.missing_phone_count))
                    .replace(
                      "{verb}",
                      digestReadiness.missing_phone_count === 1 ? "has" : "have"
                    )}{" "}
                  <Link href="/settings/staff" className="font-medium underline">
                    {t("settings.staffLink", "Settings → Staff")}
                  </Link>
                  .
                </p>
              </div>
            ) : null}

            {settings?.auto_review_request_sms !== false && !googleReviewUrl ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <p className="font-medium">
                  {t("settings.wfReviewUrlTitle", "Google review SMS needs a review URL")}
                </p>
                <p className="mt-1 text-xs text-amber-900/90">
                  {t(
                    "settings.wfReviewUrlBody",
                    "Add your Google review link in branch settings so post-visit SMS can include it."
                  )}{" "}
                  {activeBranch ? (
                    <Link
                      href={`/settings/branches/${activeBranch.id}`}
                      className="font-medium underline"
                    >
                      {t("settings.branchSettingsLink", "Branch settings")}
                    </Link>
                  ) : null}
                  .
                </p>
              </div>
            ) : null}

            {workflowGroups.map((group) => (
              <section key={group.title} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {group.title}
                </h3>
                <ul className="divide-y rounded-xl border border-neutral-200/80 bg-white">
                  {group.items.map((item) => {
                    const notWired = item.honesty === "not_wired"
                    const eventOnly = item.honesty === "event_only"
                    const toggleDisabled = notWired || savingKey === item.key
                    return (
                      <li
                        key={item.key}
                        className={
                          notWired
                            ? "flex items-start justify-between gap-4 bg-neutral-50/80 px-4 py-3"
                            : "flex items-start justify-between gap-4 px-4 py-3"
                        }
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p
                              className={
                                notWired
                                  ? "text-sm font-medium text-neutral-700"
                                  : "text-sm font-medium text-neutral-900"
                              }
                            >
                              {item.label}
                            </p>
                            {notWired ? (
                              <Badge variant="outline" className="font-normal text-[10px]">
                                {t("settings.wfHonestyNotWired", "Not enforced yet")}
                              </Badge>
                            ) : null}
                            {eventOnly ? (
                              <Badge variant="outline" className="font-normal text-[10px]">
                                {t("settings.wfHonestyEventOnly", "Event log only")}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-xs text-neutral-500">{item.description}</p>
                          {notWired ? (
                            <p className="text-[11px] text-neutral-500">
                              {t(
                                "settings.wfHonestyToggleLocked",
                                "Toggle unavailable — product does not enforce this rule yet. No fee is charged."
                              )}
                            </p>
                          ) : null}
                        </div>
                        {notWired ? (
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <Badge variant="outline" className="font-normal">
                              {t("settings.wfHonestyNotEnforced", "Not enforced")}
                            </Badge>
                            <span className="text-[10px] text-neutral-400">
                              {t("settings.wfHonestyCannotToggle", "Cannot turn on")}
                            </span>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 shrink-0 px-2"
                            disabled={toggleDisabled}
                            onClick={() => void handleToggle(item.key)}
                          >
                            <Badge
                              variant={
                                isWorkflowToggleOn(settings?.[item.key]) ? "success" : "outline"
                              }
                            >
                              {isWorkflowToggleOn(settings?.[item.key])
                                ? t("common.on", "On")
                                : t("common.off", "Off")}
                            </Badge>
                          </Button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {t("settings.wfHygieneRecallMonthsTitle", "Hygiene recall interval")}
              </h3>
              <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3">
                <p className="text-sm font-medium text-neutral-900">
                  {t("settings.wfHygieneRecallMonthsLabel", "Months between hygiene recalls")}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  {t(
                    "settings.wfHygieneRecallMonthsDesc",
                    "Used by the Recare worklist and hygiene recall SMS cron. Clinic default is {months} months when unset."
                  ).replace("{months}", String(DEFAULT_RECARE_INTERVAL_MONTHS))}{" "}
                  <Link href="/recare" className="text-primary-600 hover:underline">
                    {t("nav.recare", "Recare")}
                  </Link>
                </p>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <label
                      htmlFor="hygiene-recall-months"
                      className="text-xs font-medium text-neutral-600"
                    >
                      {t("settings.wfHygieneRecallMonthsField", "Months")}
                    </label>
                    <Input
                      id="hygiene-recall-months"
                      type="number"
                      inputMode="numeric"
                      min={MIN_RECARE_INTERVAL_MONTHS}
                      max={MAX_RECARE_INTERVAL_MONTHS}
                      className="w-24 tabular-nums"
                      value={recallMonthsDraft}
                      onChange={(e) => setRecallMonthsDraft(e.target.value)}
                      disabled={savingKey === HYGIENE_RECALL_MONTHS_KEY}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={savingKey === HYGIENE_RECALL_MONTHS_KEY}
                    onClick={() => void handleSaveRecallMonths()}
                  >
                    {t("common.save", "Save")}
                  </Button>
                </div>
              </div>
            </section>

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
                      <p className="text-sm font-medium text-neutral-900">
                        {t(item.labelKey, item.label)}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {t(item.descriptionKey, item.description)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 px-2"
                      disabled={savingKey === item.key}
                      onClick={() => void handleToggle(item.key, true)}
                    >
                      <Badge
                        variant={
                          isWorkflowToggleOn(settings?.[item.key], true) ? "success" : "outline"
                        }
                      >
                        {isWorkflowToggleOn(settings?.[item.key], true)
                          ? t("common.on", "On")
                          : t("common.off", "Off")}
                      </Badge>
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
            <p className="text-xs text-neutral-500">
              {t(
                "settings.wfCronHint",
                "SMS cron schedules and provider secrets live under Notifications. Ask your admin if reminders are not firing."
              )}{" "}
              <Link href="/settings/notifications" className="text-primary-600 hover:underline">
                {t("settings.navNotifications", "Notifications")}
              </Link>
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
