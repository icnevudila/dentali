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
import { Monitor, ExternalLink, Megaphone, Users, Clock } from "lucide-react"
import Link from "next/link"

export default function DisplaySettingsPage() {
  const { activeBranch } = useBranch()
  const { t } = useLocale()

  const displayUrl = activeBranch
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/display`
    : null

  return (
    <PermissionGate permission={PERMISSIONS.SETTINGS_MANAGE}>
      <ModulePageShell
        icon={Monitor}
        eyebrow={t("settings.eyebrow", "Administration")}
        title={t("settings.navDisplay", "Queue Display")}
        description={t(
          "settings.displaySubtitle",
          "Configure the waiting room queue display shown on a TV or monitor."
        )}
      >
        <div className="space-y-6">

          {/* Display URL */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Monitor className="h-4 w-4 text-primary-600" />
                Display Screen URL
              </CardTitle>
              <CardDescription>
                Open this URL on your waiting room TV or monitor. No login required.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                <code className="flex-1 text-sm font-mono text-neutral-700 break-all">
                  {displayUrl ?? "Select a branch to view display URL"}
                </code>
                {displayUrl && (
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/display" target="_blank">
                      <ExternalLink className="h-3.5 w-3.5 mr-1" /> Preview
                    </Link>
                  </Button>
                )}
              </div>
              <p className="text-xs text-neutral-400">
                The display screen auto-refreshes every 10 seconds and reconnects automatically if the network drops.
              </p>
            </CardContent>
          </Card>

          {/* Display Sections */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-primary-600" />
                What Is Displayed
              </CardTitle>
              <CardDescription>Sections shown on the waiting room screen.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {[
                  { label: "Now Serving", description: "Patient currently in chair (first name + queue code)", enabled: true },
                  { label: "Waiting List", description: "Patients waiting, ordered by queue position", enabled: true },
                  { label: "Live Clock", description: "Current time shown in the corner", enabled: true },
                  { label: "Clinic Announcement Ticker", description: "Scrolling text message at the bottom of the screen", enabled: false },
                ].map((section) => (
                  <li key={section.label} className="flex items-start justify-between gap-4 rounded-lg border border-neutral-100 bg-neutral-50/60 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{section.label}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">{section.description}</p>
                    </div>
                    <Badge variant={section.enabled ? "success" : "outline"}>
                      {section.enabled ? "Active" : "Coming soon"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Announcement ticker */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Megaphone className="h-4 w-4 text-primary-600" />
                Clinic Announcement
              </CardTitle>
              <CardDescription>
                A scrolling message displayed at the bottom of the waiting room screen.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-500 italic text-center">
                Announcement ticker coming soon — set a custom message for your waiting room.
              </div>
              <p className="text-xs text-neutral-400">
                Example: "Welcome to {activeBranch?.name ?? "our clinic"}! Please inform the receptionist if your wait exceeds 30 minutes."
              </p>
            </CardContent>
          </Card>

          {/* Privacy note */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-primary-600" />
                Privacy Rules
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-neutral-700">
                <li>✓ Only queue codes and first names are shown — no full patient names</li>
                <li>✓ No medical, financial, or contact information is ever displayed</li>
                <li>✓ Screen auto-blanks if no patients are waiting for more than 15 minutes</li>
              </ul>
            </CardContent>
          </Card>

        </div>
      </ModulePageShell>
    </PermissionGate>
  )
}
