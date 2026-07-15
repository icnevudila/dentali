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
import { Input } from "@/components/ui/input"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import {
  Shield,
  Lock,
  Eye,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  Clock,
  LogOut,
} from "lucide-react"
import { notify } from "@/lib/ui/notify"
import {
  describeUserAgent,
  describeUserAgentPlatform,
  fetchMySessionLogs,
  logSessionEvent,
  type SessionAuditEntry,
} from "@/lib/auth/auth-service"
import {
  changePassword,
  listMfaFactors,
  startTotpEnrollment,
  unenrollMfaFactor,
  verifyTotpEnrollment,
  type TotpFactor,
} from "@/lib/auth/security-mfa-service"

export default function SecuritySettingsPage() {
  const { session, signOut } = useAuth()
  const { t } = useLocale()
  const [logs, setLogs] = React.useState<SessionAuditEntry[]>([])
  const [loadingLogs, setLoadingLogs] = React.useState(true)
  const [logsError, setLogsError] = React.useState<string | null>(null)
  const [signingOut, setSigningOut] = React.useState(false)

  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [passwordBusy, setPasswordBusy] = React.useState(false)
  const [passwordMessage, setPasswordMessage] = React.useState<string | null>(null)
  const [passwordError, setPasswordError] = React.useState<string | null>(null)

  const [factorsLoading, setFactorsLoading] = React.useState(true)
  const [verifiedFactors, setVerifiedFactors] = React.useState<TotpFactor[]>([])
  const [mfaError, setMfaError] = React.useState<string | null>(null)
  const [enrollFactorId, setEnrollFactorId] = React.useState<string | null>(null)
  const [enrollQr, setEnrollQr] = React.useState<string | null>(null)
  const [enrollSecret, setEnrollSecret] = React.useState<string | null>(null)
  const [verifyCode, setVerifyCode] = React.useState("")
  const [mfaBusy, setMfaBusy] = React.useState(false)

  const currentUa = typeof navigator !== "undefined" ? navigator.userAgent : null
  const currentDevice = `${describeUserAgent(currentUa)} on ${describeUserAgentPlatform(currentUa)}`
  const lastSignIn = session?.user?.last_sign_in_at ?? session?.user?.created_at ?? null
  const mfaEnabled = verifiedFactors.length > 0

  const refreshFactors = React.useCallback(async () => {
    setFactorsLoading(true)
    const { verified, error } = await listMfaFactors()
    setVerifiedFactors(verified)
    setMfaError(error)
    setFactorsLoading(false)
  }, [])

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

  React.useEffect(() => {
    void refreshFactors()
  }, [refreshFactors])

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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setPasswordMessage(null)
    if (password.length < 8) {
      setPasswordError(t("signup.passwordMin", "Password must be at least 8 characters."))
      return
    }
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setPasswordError(
        t(
          "settings.securityPwComplexity",
          "Use at least one uppercase letter and one number."
        )
      )
      return
    }
    if (password !== confirmPassword) {
      setPasswordError(t("signup.passwordMatch", "Passwords do not match."))
      return
    }
    setPasswordBusy(true)
    const { error } = await changePassword(password)
    setPasswordBusy(false)
    if (error) {
      setPasswordError(error)
      return
    }
    setPassword("")
    setConfirmPassword("")
    setPasswordMessage(
      t("settings.securityPasswordUpdated", "Password updated. Keep this device signed in.")
    )
  }

  const handleStartEnroll = async () => {
    setMfaBusy(true)
    setMfaError(null)
    const { factorId, qrCode, secret, error } = await startTotpEnrollment("Staff authenticator")
    setMfaBusy(false)
    if (error || !factorId || !qrCode) {
      setMfaError(error ?? t("settings.securityMfaEnrollFail", "Could not start 2FA enrollment."))
      return
    }
    setEnrollFactorId(factorId)
    setEnrollQr(qrCode)
    setEnrollSecret(secret)
    setVerifyCode("")
  }

  const handleVerifyEnroll = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!enrollFactorId || verifyCode.trim().length < 6) return
    setMfaBusy(true)
    const { error } = await verifyTotpEnrollment(enrollFactorId, verifyCode)
    setMfaBusy(false)
    if (error) {
      setMfaError(error)
      return
    }
    setEnrollFactorId(null)
    setEnrollQr(null)
    setEnrollSecret(null)
    setVerifyCode("")
    notify.success(t("settings.securityMfaEnabled", "Two-factor authentication is enabled."))
    await refreshFactors()
  }

  const handleCancelEnroll = async () => {
    if (enrollFactorId) {
      await unenrollMfaFactor(enrollFactorId)
    }
    setEnrollFactorId(null)
    setEnrollQr(null)
    setEnrollSecret(null)
    setVerifyCode("")
    setMfaError(null)
  }

  const handleUnenroll = async (factorId: string) => {
    const ok = await notify.confirm(
      t(
        "settings.securityMfaRemoveConfirm",
        "Remove authenticator from this account? You can enroll again later."
      )
    )
    if (!ok) return
    setMfaBusy(true)
    const { error } = await unenrollMfaFactor(factorId)
    setMfaBusy(false)
    if (error) {
      setMfaError(error)
      return
    }
    notify.success(t("settings.securityMfaRemoved", "Authenticator removed."))
    await refreshFactors()
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
                {t("settings.securityPasswordTitle", "Password")}
              </CardTitle>
              <CardDescription>
                {t(
                  "settings.securityPasswordChangeDesc",
                  "Change your sign-in password while you are logged in. Minimum 8 characters with an uppercase letter and a number."
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
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

              <form onSubmit={(e) => void handleChangePassword(e)} className="space-y-3 border-t border-neutral-100 pt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-600" htmlFor="new-password">
                      {t("settings.securityNewPassword", "New password")}
                    </label>
                    <Input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={passwordBusy}
                    />
                  </div>
                  <div>
                    <label
                      className="mb-1 block text-xs font-medium text-neutral-600"
                      htmlFor="confirm-password"
                    >
                      {t("settings.securityConfirmPassword", "Confirm password")}
                    </label>
                    <Input
                      id="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={passwordBusy}
                    />
                  </div>
                </div>
                {passwordError ? (
                  <p className="text-sm text-red-600">{passwordError}</p>
                ) : null}
                {passwordMessage ? (
                  <p className="text-sm text-green-700">{passwordMessage}</p>
                ) : null}
                <Button type="submit" size="sm" disabled={passwordBusy || !password}>
                  {passwordBusy
                    ? t("common.saving", "Saving…")
                    : t("settings.securityUpdatePassword", "Update password")}
                </Button>
              </form>
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
                  "settings.security2faPersonalDesc",
                  "Protect your account with an authenticator app (TOTP). Organization-wide enforcement is still set in the Supabase Auth dashboard."
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-neutral-900">
                    {t("settings.security2faYourAccount", "Your authenticator")}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {factorsLoading
                      ? t("common.loading", "Loading…")
                      : mfaEnabled
                        ? t("settings.security2faOn", "Enabled on this account")
                        : t("settings.security2faOff", "Not set up yet")}
                  </p>
                </div>
                <Badge variant={mfaEnabled ? "success" : "outline"}>
                  {mfaEnabled
                    ? t("settings.securityEnabled", "Enabled")
                    : t("settings.securityNotRequired", "Off")}
                </Badge>
              </div>

              {mfaError ? <p className="text-sm text-amber-700">{mfaError}</p> : null}

              {mfaEnabled && !enrollFactorId ? (
                <ul className="space-y-2">
                  {verifiedFactors.map((factor) => (
                    <li
                      key={factor.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-100 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-neutral-900">
                          {factor.friendly_name || t("settings.securityTotpDefault", "Authenticator")}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {t("settings.securityFactorAdded", "Added {when}").replace(
                            "{when}",
                            new Date(factor.created_at).toLocaleString("en-PH", {
                              dateStyle: "medium",
                              timeZone: "Asia/Manila",
                            })
                          )}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={mfaBusy}
                        className="border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => void handleUnenroll(factor.id)}
                      >
                        {t("settings.securityRemove2fa", "Remove")}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {!enrollFactorId && !mfaEnabled ? (
                <Button size="sm" disabled={mfaBusy || factorsLoading} onClick={() => void handleStartEnroll()}>
                  {mfaBusy
                    ? t("common.pleaseWait", "Please wait…")
                    : t("settings.securitySetup2fa", "Set up authenticator")}
                </Button>
              ) : null}

              {enrollFactorId && enrollQr ? (
                <div className="space-y-3 rounded-lg border border-primary-100 bg-primary-50/40 p-4">
                  <p className="text-sm text-neutral-700">
                    {t(
                      "settings.securityScanQr",
                      "Scan this QR code with Google Authenticator, Authy, or a similar app, then enter the 6-digit code."
                    )}
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element -- Supabase returns inline SVG data URL */}
                  <img
                    src={enrollQr}
                    alt={t("settings.securityQrAlt", "Authenticator QR code")}
                    className="mx-auto h-44 w-44 rounded-lg bg-white p-2"
                  />
                  {enrollSecret ? (
                    <p className="break-all text-center font-mono text-xs text-neutral-500">
                      {t("settings.securityManualSecret", "Manual key:")} {enrollSecret}
                    </p>
                  ) : null}
                  <form onSubmit={(e) => void handleVerifyEnroll(e)} className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[8rem] flex-1">
                      <label className="mb-1 block text-xs font-medium text-neutral-600" htmlFor="mfa-code">
                        {t("settings.securityTotpCode", "6-digit code")}
                      </label>
                      <Input
                        id="mfa-code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={10}
                        value={verifyCode}
                        onChange={(e) => setVerifyCode(e.target.value.replace(/\s/g, ""))}
                        disabled={mfaBusy}
                      />
                    </div>
                    <Button type="submit" size="sm" disabled={mfaBusy || verifyCode.trim().length < 6}>
                      {t("settings.securityVerify2fa", "Verify & enable")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={mfaBusy}
                      onClick={() => void handleCancelEnroll()}
                    >
                      {t("common.cancel", "Cancel")}
                    </Button>
                  </form>
                </div>
              ) : null}

              <div className="rounded-lg border border-dashed border-neutral-200 px-4 py-3">
                <p className="text-sm font-medium text-neutral-800">
                  {t("settings.security2faOrg", "Organization-wide 2FA")}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  {t(
                    "settings.security2faProviderHint",
                    "Requiring every staff member to use 2FA is configured in the Supabase Auth dashboard (MFA / Assurance Level), not as a clinic settings toggle."
                  )}
                </p>
                <Badge variant="outline" className="mt-2">
                  {t("settings.securityNotRequired", "Not required org-wide")}
                </Badge>
              </div>
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
                      <li
                        key={entry.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                      >
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
