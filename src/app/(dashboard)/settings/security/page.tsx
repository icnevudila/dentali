"use client"

import * as React from "react"
import Link from "next/link"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useAuth } from "@/hooks/use-auth"
import { useLocale } from "@/hooks/use-locale"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { Shield, Lock, Eye, KeyRound, AlertTriangle, CheckCircle2, Clock, LogOut } from "lucide-react"
import { notify } from "@/lib/ui/notify"
import {
  describeUserAgent,
  describeUserAgentPlatform,
  fetchMySessionLogs,
  logSessionEvent,
  type SessionAuditEntry,
} from "@/lib/auth/auth-service"

export default function SecuritySettingsPage() {
  const { session, signOut } = useAuth()
  const { t } = useLocale()
  const [logs, setLogs] = React.useState<SessionAuditEntry[]>([])
  const [loadingLogs, setLoadingLogs] = React.useState(true)
  const [logsError, setLogsError] = React.useState<string | null>(null)
  const [signingOut, setSigningOut] = React.useState(false)

  const currentUa = typeof navigator !== "undefined" ? navigator.userAgent : null
  const currentDevice = `${describeUserAgent(currentUa)} on ${describeUserAgentPlatform(currentUa)}`
  const lastSignIn = session?.user?.last_sign_in_at ?? session?.user?.created_at ?? null

  React.useEffect(() => {
    let cancelled = false
    setLoadingLogs(true)
    void fetchMySessionLogs(12).then(({ data, error }) => {
      if (cancelled) return
      setLogs(data)
      setLogsError(error)
      setLoadingLogs(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleSignOut = async () => {
    const ok = await notify.confirm(
      t(
        "settings.securitySignOutConfirm",
        "Sign out of this device? You will need to log in again to continue."
      )
    )
    if (!ok) return
    setSigningOut(true)
    try {
      await logSessionEvent("logout")
      await signOut()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <PermissionGate permission={PERMISSIONS.SETTINGS_MANAGE}>
      <ModulePageShell
        icon={Shield}
        eyebrow={t("settings.groupAccess", "Access")}
        title={t("settings.navSecurity", "Security")}
        description={t(
          "settings.securitySubtitle",
          "Manage session security, password policies, and access controls."
        )}
      >
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-4 w-4 text-primary-600" />
                {t("settings.securityPasswordTitle", "Password Policy")}
              </CardTitle>
              <CardDescription>
                {t(
                  "settings.securityPasswordDesc",
                  "Requirements for all staff passwords in this organization."
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {[
                  { label: t("settings.securityPwMin", "Minimum 8 characters"), met: true },
                  {
                    label: t("settings.securityPwUpper", "At least one uppercase letter"),
                    met: true,
                  },
                  { label: t("settings.securityPwNumber", "At least one number"), met: true },
                  {
                    label: t("settings.securityPwSpecial", "Special character required"),
                    met: false,
                  },
                  {
                    label: t("settings.securityPwExpiry", "Password expiry: 90 days"),
                    met: false,
                  },
                ].map((policy) => (
                  <li key={policy.label} className="flex items-center gap-3 text-sm">
                    {policy.met ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                    )}
                    <span className={policy.met ? "text-neutral-700" : "text-neutral-400"}>
                      {policy.label}
                    </span>
                    {!policy.met ? (
                      <Badge variant="outline" className="text-[10px]">
                        {t("settings.securityNotEnforced", "Not enforced")}
                      </Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-neutral-400">
                {t(
                  "settings.securityPasswordHint",
                  "Password policies are managed through your authentication provider. Contact your system administrator to enforce additional requirements."
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="h-4 w-4 text-primary-600" />
                {t("settings.security2faTitle", "Two-Factor Authentication (2FA)")}
              </CardTitle>
              <CardDescription>
                {t(
                  "settings.security2faDesc",
                  "Require 2FA for all staff members to increase account security."
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-neutral-900">
                    {t("settings.security2faOrg", "Organization-wide 2FA")}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {t(
                      "settings.security2faOrgHint",
                      "All staff must enroll in 2FA before accessing the system"
                    )}
                  </p>
                </div>
                <Badge variant="outline">{t("settings.securityNotRequired", "Not required")}</Badge>
              </div>
              <p className="text-xs text-neutral-400">
                {t(
                  "settings.security2faProviderHint",
                  "Two-factor authentication enforcement is configured in your Supabase authentication settings. Staff can set up their own 2FA from their account profile."
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Eye className="h-4 w-4 text-primary-600" />
                {t("settings.securitySessionsTitle", "This device")}
              </CardTitle>
              <CardDescription>
                {t(
                  "settings.securitySessionsDesc",
                  "Current signed-in session for your account on this browser."
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-100 bg-neutral-50/60 px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-primary-50 p-1.5">
                    <Shield className="h-3.5 w-3.5 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-900">
                      {currentDevice}
                      <Badge variant="success" className="ml-2 text-[10px]">
                        {t("settings.securityCurrent", "Current")}
                      </Badge>
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-neutral-500">
                      <Clock className="h-3 w-3" />
                      {lastSignIn
                        ? t("settings.securityLastSignIn", "Last sign-in {when}").replace(
                            "{when}",
                            new Date(lastSignIn).toLocaleString("en-PH", {
                              dateStyle: "short",
                              timeStyle: "short",
                              timeZone: "Asia/Manila",
                            })
                          )
                        : t("settings.securitySessionActive", "Session active")}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50"
                  disabled={signingOut}
                  onClick={() => void handleSignOut()}
                >
                  <LogOut className="mr-1 h-3.5 w-3.5" />
                  {signingOut
                    ? t("common.signingOut", "Signing out…")
                    : t("settings.securitySignOutDevice", "Sign out this device")}
                </Button>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  {t("settings.securityLoginHistory", "Recent login activity")}
                </p>
                {loadingLogs ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-10 animate-pulse rounded-lg bg-neutral-100" />
                    ))}
                  </div>
                ) : logsError ? (
                  <p className="py-2 text-sm text-amber-700">
                    {t(
                      "settings.securityLogsError",
                      "Could not load login history. Try again after refreshing."
                    )}
                  </p>
                ) : logs.length === 0 ? (
                  <p className="py-2 text-sm text-neutral-500">
                    {t(
                      "settings.securityNoLogs",
                      "No login history yet. Future sign-ins will appear here."
                    )}
                  </p>
                ) : (
                  <ul className="divide-y divide-neutral-100">
                    {logs.map((entry) => (
                      <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                        <div>
                          <p className="text-sm font-medium capitalize text-neutral-900">
                            {entry.event_type}
                          </p>
                          <p className="text-xs text-neutral-500">
                            {describeUserAgent(entry.user_agent)} ·{" "}
                            {describeUserAgentPlatform(entry.user_agent)}
                          </p>
                        </div>
                        <p className="text-xs text-neutral-400">
                          {new Date(entry.created_at).toLocaleString("en-PH", {
                            dateStyle: "short",
                            timeStyle: "short",
                            timeZone: "Asia/Manila",
                          })}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary-100 bg-primary-50/30">
            <CardContent className="pt-5">
              <p className="text-sm text-primary-800">
                <strong>{t("settings.securityTipLabel", "Security tip:")}</strong>{" "}
                {t(
                  "settings.securityTipBody",
                  "All login events, permission changes, and data access are recorded in the"
                )}{" "}
                <Link href="/settings/audit" className="font-medium underline">
                  {t("settings.navAudit", "Audit Log")}
                </Link>
                . {t("settings.securityTipTail", "Review it regularly to detect suspicious activity.")}
              </p>
            </CardContent>
          </Card>
        </div>
      </ModulePageShell>
    </PermissionGate>
  )
}
