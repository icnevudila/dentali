"use client"

import * as React from "react"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { Shield, Lock, Eye, KeyRound, AlertTriangle, CheckCircle2, Clock } from "lucide-react"
import { notify } from "@/lib/ui/notify"

interface SecuritySession {
  id: string
  device: string
  location: string
  lastActive: string
  current: boolean
}

// Mock session data — in production this would come from Supabase auth.sessions
const MOCK_SESSIONS: SecuritySession[] = [
  {
    id: "current",
    device: "Chrome on Windows",
    location: "Philippines",
    lastActive: new Date().toISOString(),
    current: true,
  },
]

export default function SecuritySettingsPage() {
  const { activeBranch } = useBranch()
  const { t } = useLocale()
  const [sessions] = React.useState<SecuritySession[]>(MOCK_SESSIONS)

  const handleRevokeSession = async (sessionId: string) => {
    const ok = await notify.confirm(
      "Revoke this session? The device will be logged out immediately."
    )
    if (!ok) return
    notify.success("Session revoked")
    // In production: call supabase.auth.admin.signOut(sessionId)
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

          {/* Password Policy */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-4 w-4 text-primary-600" />
                Password Policy
              </CardTitle>
              <CardDescription>
                Requirements for all staff passwords in this organization.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {[
                  { label: "Minimum 8 characters", met: true },
                  { label: "At least one uppercase letter", met: true },
                  { label: "At least one number", met: true },
                  { label: "Special character required", met: false },
                  { label: "Password expiry: 90 days", met: false },
                ].map((policy) => (
                  <li key={policy.label} className="flex items-center gap-3 text-sm">
                    {policy.met ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    )}
                    <span className={policy.met ? "text-neutral-700" : "text-neutral-400"}>
                      {policy.label}
                    </span>
                    {!policy.met && (
                      <Badge variant="outline" className="text-[10px]">Not enforced</Badge>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-neutral-400">
                Password policies are managed through your authentication provider. Contact your system administrator to enforce additional requirements.
              </p>
            </CardContent>
          </Card>

          {/* Two-Factor Authentication */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="h-4 w-4 text-primary-600" />
                Two-Factor Authentication (2FA)
              </CardTitle>
              <CardDescription>
                Require 2FA for all staff members to increase account security.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-neutral-900">Organization-wide 2FA</p>
                  <p className="text-xs text-neutral-500 mt-0.5">All staff must enroll in 2FA before accessing the system</p>
                </div>
                <Badge variant="outline">Not required</Badge>
              </div>
              <p className="text-xs text-neutral-400">
                Two-factor authentication enforcement is configured in your Supabase authentication settings. Staff can set up their own 2FA from their account profile.
              </p>
            </CardContent>
          </Card>

          {/* Active Sessions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Eye className="h-4 w-4 text-primary-600" />
                Active Sessions
              </CardTitle>
              <CardDescription>
                Review and revoke active login sessions for your account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <p className="text-sm text-neutral-500 py-4 text-center">No active sessions found.</p>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {sessions.map((session) => (
                    <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-full bg-primary-50 p-1.5">
                          <Shield className="h-3.5 w-3.5 text-primary-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-neutral-900">
                            {session.device}
                            {session.current && (
                              <Badge variant="success" className="ml-2 text-[10px]">Current</Badge>
                            )}
                          </p>
                          <p className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {session.location} · Last active {new Date(session.lastActive).toLocaleString("en-PH", { dateStyle: "short", timeStyle: "short" })}
                          </p>
                        </div>
                      </div>
                      {!session.current && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => void handleRevokeSession(session.id)}
                        >
                          Revoke
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Audit note */}
          <Card className="border-primary-100 bg-primary-50/30">
            <CardContent className="pt-5">
              <p className="text-sm text-primary-800">
                <strong>Security tip:</strong> All login events, permission changes, and data access are recorded in the{" "}
                <a href="/settings/audit" className="underline font-medium">Audit Log</a>. Review it regularly to detect suspicious activity.
              </p>
            </CardContent>
          </Card>

        </div>
      </ModulePageShell>
    </PermissionGate>
  )
}
