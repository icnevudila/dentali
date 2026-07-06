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
import { Tablet, QrCode, Clock, ExternalLink, RefreshCw } from "lucide-react"
import Link from "next/link"

export default function KioskSettingsPage() {
  const { activeBranch } = useBranch()
  const { t } = useLocale()

  const kioskUrl = activeBranch
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/kiosk`
    : null

  return (
    <PermissionGate permission={PERMISSIONS.SETTINGS_MANAGE}>
      <ModulePageShell
        icon={Tablet}
        eyebrow={t("settings.eyebrow", "Administration")}
        title={t("settings.navKiosk", "Kiosk")}
        description={t(
          "settings.kioskSubtitle",
          "Configure the patient self-check-in kiosk displayed on a tablet at reception."
        )}
      >
        <div className="space-y-6">

          {/* Kiosk URL */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Tablet className="h-4 w-4 text-primary-600" />
                Kiosk Access URL
              </CardTitle>
              <CardDescription>
                Open this URL on your reception tablet and put it in fullscreen mode.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                <code className="flex-1 text-sm font-mono text-neutral-700 break-all">
                  {kioskUrl ?? "Select a branch to view kiosk URL"}
                </code>
                {kioskUrl && (
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/kiosk" target="_blank">
                      <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open
                    </Link>
                  </Button>
                )}
              </div>
              <p className="text-xs text-neutral-400">
                The kiosk requires no login — it uses a scoped public token. Only appointment check-in and intake functions are exposed.
              </p>
            </CardContent>
          </Card>

          {/* Kiosk Options */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <QrCode className="h-4 w-4 text-primary-600" />
                Kiosk Features
              </CardTitle>
              <CardDescription>Available actions on the patient self-service kiosk.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {[
                  { label: "Check in for appointment", enabled: true, description: "Patients look up their name and confirm arrival" },
                  { label: "New patient intake", enabled: true, description: "Walk-ins can fill out their profile and medical history" },
                  { label: "Update medical history", enabled: true, description: "Returning patients can update their health information" },
                  { label: "Staff workstation", enabled: true, description: "Staff can override and assist patients at the kiosk" },
                ].map((feature) => (
                  <li key={feature.label} className="flex items-start justify-between gap-4 rounded-lg border border-neutral-100 bg-neutral-50/60 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{feature.label}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">{feature.description}</p>
                    </div>
                    <Badge variant={feature.enabled ? "success" : "outline"}>
                      {feature.enabled ? "Active" : "Inactive"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Session timeout */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-primary-600" />
                Session Timeout
              </CardTitle>
              <CardDescription>
                The kiosk automatically resets after inactivity to protect patient privacy.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-neutral-900">Auto-reset after inactivity</p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  If no interaction is detected within 2 minutes, the kiosk returns to the home screen
                </p>
              </div>
              <Badge variant="info">2 minutes</Badge>
            </CardContent>
          </Card>

          {/* Refresh reminder */}
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-amber-900">
            <RefreshCw className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Keep kiosk tab refreshed</p>
              <p className="mt-0.5 text-amber-800">
                Set your tablet browser to reload daily or use a kiosk management app (e.g. Kiosk Pro, Fully Kiosk) for automatic refresh and fullscreen enforcement.
              </p>
            </div>
          </div>

        </div>
      </ModulePageShell>
    </PermissionGate>
  )
}
