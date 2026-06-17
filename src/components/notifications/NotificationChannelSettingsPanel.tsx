"use client"

import * as React from "react"
import {
  fetchNotificationChannelHealth,
  fetchNotificationChannelSettings,
  formatEmailFromPreview,
  sendTestEmail,
  upsertNotificationChannelSettings,
  type NotificationChannelHealth,
  type NotificationChannelSettings,
  type NotificationChannelSettingsUpsert,
  type PatientChannelPreference,
} from "@/lib/notifications/notification-service"
import { buildWhatsAppSendUrl } from "@/lib/notifications/whatsapp"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useLocale } from "@/hooks/use-locale"
import { AlertTriangle, CheckCircle2, Mail, MessageSquare, Phone, Save, Send, Settings2 } from "lucide-react"

type Props = {
  branchId: string
  canWrite: boolean
}

const CHANNEL_OPTIONS: { value: PatientChannelPreference; labelKey: string; fallback: string }[] = [
  { value: "whatsapp_manual", labelKey: "settings.channelWhatsApp", fallback: "WhatsApp (manual, free)" },
  { value: "sms", labelKey: "settings.channelSms", fallback: "SMS (Semaphore)" },
  { value: "email", labelKey: "settings.channelEmail", fallback: "Email (Resend)" },
]

export function NotificationChannelSettingsPanel({ branchId, canWrite }: Props) {
  const { t } = useLocale()
  const [settings, setSettings] = React.useState<NotificationChannelSettings | null>(null)
  const [health, setHealth] = React.useState<NotificationChannelHealth | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [testEmail, setTestEmail] = React.useState("")
  const [sendingTest, setSendingTest] = React.useState(false)
  const [semaphoreApiKeyDraft, setSemaphoreApiKeyDraft] = React.useState("")
  const [resendApiKeyDraft, setResendApiKeyDraft] = React.useState("")
  const [clearSemaphoreKey, setClearSemaphoreKey] = React.useState(false)
  const [clearResendKey, setClearResendKey] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    const [settingsRes, healthRes] = await Promise.all([
      fetchNotificationChannelSettings(branchId),
      fetchNotificationChannelHealth(branchId),
    ])
    setSettings(settingsRes.data)
    setHealth(healthRes.data)
    setError(settingsRes.error ?? healthRes.error)
    setSemaphoreApiKeyDraft("")
    setResendApiKeyDraft("")
    setClearSemaphoreKey(false)
    setClearResendKey(false)
    setLoading(false)
  }, [branchId])

  React.useEffect(() => {
    void load()
  }, [load])

  const patch = (partial: Partial<NotificationChannelSettings>) => {
    setSettings((prev) => (prev ? { ...prev, ...partial } : prev))
  }

  const handleSave = async () => {
    if (!settings || !canWrite) return
    setSaving(true)
    setMessage(null)
    const payload: NotificationChannelSettingsUpsert = {
      ...settings,
      branch_id: branchId,
    }
    if (semaphoreApiKeyDraft.trim()) {
      payload.semaphore_api_key = semaphoreApiKeyDraft.trim()
    }
    if (resendApiKeyDraft.trim()) {
      payload.resend_api_key = resendApiKeyDraft.trim()
    }
    if (clearSemaphoreKey) payload.clear_semaphore_api_key = true
    if (clearResendKey) payload.clear_resend_api_key = true

    const { data, error: err } = await upsertNotificationChannelSettings(payload)
    setSaving(false)
    if (err) {
      setError(err)
      return
    }
    setSettings(data)
    setMessage(t("settings.channelSaved", "Channel settings saved."))
    void load()
  }

  const handleTestEmail = async () => {
    if (!settings || !testEmail.trim()) return
    setSendingTest(true)
    setMessage(null)
    const { data, error: err } = await sendTestEmail({
      to: testEmail.trim(),
      branchId,
      clinicName: settings.clinic_display_name,
    })
    setSendingTest(false)
    if (err) {
      setError(err)
      return
    }
    setMessage(
      data?.dry_run
        ? t(
            "settings.channelTestEmailDryRun",
            "Dry-run: email was not sent. Disable email dry-run and add your Resend API key below to go live."
          )
        : t("settings.channelTestEmailSent", "Test email sent.")
    )
  }

  if (loading) {
    return <p className="text-sm text-neutral-500">{t("common.loading", "Loading…")}</p>
  }

  if (!settings) {
    return (
      <p className="text-sm text-red-600">
        {error ?? t("settings.channelLoadFailed", "Could not load channel settings.")}
      </p>
    )
  }

  const emailFromPreview = formatEmailFromPreview(
    settings.clinic_display_name,
    settings.email_from_address
  )
  const whatsAppTestHref = settings.whatsapp_clinic_phone
    ? buildWhatsAppSendUrl(
        settings.whatsapp_clinic_phone,
        t("settings.channelWhatsAppTestBody", "Hello — this is a test from our clinic.")
      )
    : null

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4" />
            {t("settings.channelProviderStatus", "Provider status")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <ProviderCard
            title="SMS"
            icon={MessageSquare}
            configured={health?.sms.configured ?? settings.sms_api_key_configured}
            provider={health?.sms.provider ?? "Semaphore"}
            source={health?.sms.source}
            keyHint={settings.sms_api_key_hint}
            hint={t(
              "settings.channelSmsSecretHint",
              "Enter your Semaphore API key below — saved securely for your organization. No Supabase dashboard needed."
            )}
          />
          <ProviderCard
            title={t("settings.channelEmailTitle", "Email")}
            icon={Mail}
            configured={health?.email.configured ?? settings.email_api_key_configured}
            provider={health?.email.provider ?? "Resend"}
            source={health?.email.source}
            keyHint={settings.email_api_key_hint}
            hint={t(
              "settings.channelEmailSecretHint",
              "Free tier: ~100 emails/day. Enter your Resend API key below, verify your domain, then set the from address."
            )}
          />
          <ProviderCard
            title="WhatsApp"
            icon={Phone}
            configured
            provider={t("settings.channelWhatsAppManual", "Manual wa.me")}
            hint={
              health?.whatsapp.note ??
              t("settings.channelWhatsAppHint", "Staff opens WhatsApp with a pre-filled message — always free.")
            }
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("settings.channelClinicIdentity", "Clinic identity")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field
              label={t("settings.channelDisplayName", "Display name")}
              hint={t("settings.channelDisplayNameHint", "Shown in SMS sender label and email From name.")}
            >
              <Input
                value={settings.clinic_display_name}
                onChange={(e) => patch({ clinic_display_name: e.target.value })}
                disabled={!canWrite}
              />
            </Field>
            <Field
              label={t("settings.channelDefaultRoute", "Default patient channel")}
              hint={t("settings.channelDefaultRouteHint", "What staff should try first when contacting patients.")}
            >
              <select
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                value={settings.default_patient_channel}
                onChange={(e) =>
                  patch({ default_patient_channel: e.target.value as PatientChannelPreference })
                }
                disabled={!canWrite}
              >
                {CHANNEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.labelKey, opt.fallback)}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label={t("settings.channelWhatsAppPhone", "WhatsApp / clinic phone")}
              hint={t("settings.channelWhatsAppPhoneHint", "Used for wa.me links. Defaults to branch contact number.")}
            >
              <Input
                type="tel"
                value={settings.whatsapp_clinic_phone ?? ""}
                onChange={(e) => patch({ whatsapp_clinic_phone: e.target.value })}
                disabled={!canWrite}
                placeholder="09XX XXX XXXX"
              />
            </Field>
            {whatsAppTestHref ? (
              <Button variant="outline" size="sm" asChild>
                <a href={whatsAppTestHref} target="_blank" rel="noopener noreferrer">
                  {t("settings.channelTestWhatsApp", "Test WhatsApp link")}
                </a>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("settings.channelSmsCard", "SMS (Semaphore)")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ToggleRow
              label={t("settings.dryRun", "Dry-run mode")}
              description={t(
                "settings.channelSmsDryRunHint",
                "When on, SMS is logged but not sent — safe for testing without credits."
              )}
              checked={settings.dry_run_mode}
              onChange={(checked) => patch({ dry_run_mode: checked })}
              disabled={!canWrite}
            />
            <Field
              label={t("settings.channelSmsSender", "Sender name")}
              hint={t("settings.channelSmsSenderHint", "Max 11 characters. Must be registered in Semaphore.")}
            >
              <Input
                value={settings.sms_sender_name}
                maxLength={11}
                onChange={(e) => patch({ sms_sender_name: e.target.value })}
                disabled={!canWrite}
              />
            </Field>
            <ApiKeyField
              label={t("settings.channelSmsApiKey", "Semaphore API key")}
              hint={t(
                "settings.channelSmsApiKeyHint",
                "From semaphore.co dashboard. Leave blank to keep the current key."
              )}
              configured={settings.sms_api_key_configured}
              configuredLabel={t("settings.channelSmsApiKeyConfigured", "Key saved")}
              keyHint={settings.sms_api_key_hint}
              value={semaphoreApiKeyDraft}
              onChange={setSemaphoreApiKeyDraft}
              clearRequested={clearSemaphoreKey}
              onClearToggle={() => {
                setClearSemaphoreKey((prev) => !prev)
                if (!clearSemaphoreKey) setSemaphoreApiKeyDraft("")
              }}
              clearLabel={t("settings.channelSmsApiKeyClear", "Remove saved key")}
              disabled={!canWrite}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("settings.channelEmailCard", "Email (Resend)")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ToggleRow
              label={t("settings.channelEmailDryRun", "Email dry-run")}
              description={t(
                "settings.channelEmailDryRunHint",
                "When on, emails are preview-only until you add a Resend API key below and turn this off."
              )}
              checked={settings.email_dry_run_mode}
              onChange={(checked) => patch({ email_dry_run_mode: checked })}
              disabled={!canWrite}
            />
            <ApiKeyField
              label={t("settings.channelEmailApiKey", "Resend API key")}
              hint={t(
                "settings.channelEmailApiKeyHint",
                "From resend.com dashboard. Leave blank to keep the current key."
              )}
              configured={settings.email_api_key_configured}
              configuredLabel={t("settings.channelEmailApiKeyConfigured", "Key saved")}
              keyHint={settings.email_api_key_hint}
              value={resendApiKeyDraft}
              onChange={setResendApiKeyDraft}
              clearRequested={clearResendKey}
              onClearToggle={() => {
                setClearResendKey((prev) => !prev)
                if (!clearResendKey) setResendApiKeyDraft("")
              }}
              clearLabel={t("settings.channelEmailApiKeyClear", "Remove saved key")}
              disabled={!canWrite}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t("settings.channelEmailFrom", "From address")}
                hint={t(
                  "settings.channelEmailFromHint",
                  "After domain verification, e.g. noreply@yourclinic.ph. Leave empty to use Resend sandbox."
                )}
              >
                <Input
                  type="email"
                  value={settings.email_from_address ?? ""}
                  onChange={(e) => patch({ email_from_address: e.target.value })}
                  disabled={!canWrite}
                  placeholder="noreply@yourclinic.ph"
                />
              </Field>
              <Field
                label={t("settings.channelEmailReplyTo", "Reply-to (optional)")}
                hint={t("settings.channelEmailReplyHint", "Where patient replies should go, e.g. frontdesk@gmail.com")}
              >
                <Input
                  type="email"
                  value={settings.email_reply_to ?? ""}
                  onChange={(e) => patch({ email_reply_to: e.target.value })}
                  disabled={!canWrite}
                />
              </Field>
            </div>
            <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
              <span className="font-medium text-neutral-800">{t("settings.channelEmailPreview", "From preview")}: </span>
              {emailFromPreview}
            </div>
            <div className="flex flex-wrap items-end gap-2 border-t pt-4">
              <div className="min-w-[200px] flex-1">
                <label className="text-xs font-medium text-neutral-500">
                  {t("settings.channelTestEmail", "Send test email")}
                </label>
                <Input
                  type="email"
                  className="mt-1"
                  placeholder="you@clinic.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                className="gap-2"
                disabled={!testEmail.trim() || sendingTest}
                onClick={() => void handleTestEmail()}
              >
                <Send className="h-4 w-4" />
                {sendingTest ? t("common.loading", "Sending…") : t("settings.notificationsTest", "Test")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {canWrite ? (
        <div className="flex justify-end">
          <Button className="gap-2" onClick={() => void handleSave()} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? t("common.loading", "Saving…") : t("settings.channelSave", "Save channel settings")}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function ProviderCard({
  title,
  icon: Icon,
  configured,
  provider,
  source,
  keyHint,
  hint,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  configured: boolean
  provider: string
  source?: NotificationChannelHealth["sms"]["source"]
  keyHint?: string | null
  hint: string
}) {
  const { t } = useLocale()
  const sourceLabel =
    source === "settings"
      ? t("settings.channelProviderSourceSettings", "Configured in Settings")
      : source === "env"
        ? t("settings.channelProviderSourceEnv", "Configured via server env (fallback)")
        : t("settings.channelProviderSourceNone", "Not configured")

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium text-neutral-900">
          <Icon className="h-4 w-4 text-primary-600" aria-hidden />
          {title}
        </div>
        <Badge variant={configured ? "success" : "warning"} className="gap-1 font-normal">
          {configured ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
          {configured ? "OK" : "Setup"}
        </Badge>
      </div>
      <p className="mt-2 text-xs text-neutral-500">{provider}</p>
      <p className="mt-1 text-xs text-neutral-600">{sourceLabel}</p>
      {keyHint ? (
        <p className="mt-1 font-mono text-[11px] text-neutral-500">
          {keyHint}
        </p>
      ) : null}
      <p className="mt-2 text-xs leading-5 text-neutral-600">{hint}</p>
    </div>
  )
}

function ApiKeyField({
  label,
  hint,
  configured,
  configuredLabel,
  keyHint,
  value,
  onChange,
  clearRequested,
  onClearToggle,
  clearLabel,
  disabled,
}: {
  label: string
  hint: string
  configured: boolean
  configuredLabel: string
  keyHint: string | null
  value: string
  onChange: (value: string) => void
  clearRequested: boolean
  onClearToggle: () => void
  clearLabel: string
  disabled?: boolean
}) {
  return (
    <Field label={label} hint={hint}>
      {configured && keyHint ? (
        <p className="mb-2 text-xs text-emerald-700">
          {configuredLabel}: <span className="font-mono">{keyHint}</span>
        </p>
      ) : null}
      <Input
        type="password"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || clearRequested}
        placeholder={configured ? "••••••••" : "sk_…"}
      />
      {configured && !disabled ? (
        <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-neutral-600">
          <input type="checkbox" checked={clearRequested} onChange={onClearToggle} />
          {clearLabel}
        </label>
      ) : null}
    </Field>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="text-xs font-medium text-neutral-700">{label}</label>
      {hint ? <p className="mt-0.5 text-xs text-neutral-500">{hint}</p> : null}
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-200 px-3 py-3">
      <input
        type="checkbox"
        className="mt-1"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span>
        <span className="block text-sm font-medium text-neutral-900">{label}</span>
        <span className="mt-0.5 block text-xs text-neutral-500">{description}</span>
      </span>
    </label>
  )
}
