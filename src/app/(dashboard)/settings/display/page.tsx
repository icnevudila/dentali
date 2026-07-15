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
import {
  fetchBranchSetting,
  saveBranchDisplayAnnouncement,
} from "@/lib/org/branch-context-service"
import { notify } from "@/lib/ui/notify"

export default function DisplaySettingsPage() {
  const { activeBranch } = useBranch()
  const { t } = useLocale()
  const [announcement, setAnnouncement] = React.useState("")
  const [savedAnnouncement, setSavedAnnouncement] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  const displayUrl = activeBranch
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/display`
    : null

  const announcementActive = savedAnnouncement.trim().length > 0
  const dirty = announcement.trim() !== savedAnnouncement.trim()

  React.useEffect(() => {
    if (!activeBranch?.id) return
    let cancelled = false
    setLoading(true)
    void fetchBranchSetting(activeBranch.id, "display_announcement").then(({ value, error }) => {
      if (cancelled) return
      if (error) {
        notify.error(error)
      } else {
        const next = value ?? ""
        setAnnouncement(next)
        setSavedAnnouncement(next)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [activeBranch?.id])

  const handleSave = async () => {
    if (!activeBranch?.id) return
    setSaving(true)
    const { error } = await saveBranchDisplayAnnouncement(activeBranch.id, announcement)
    setSaving(false)
    if (error) {
      notify.error(error)
      return
    }
    const trimmed = announcement.trim().slice(0, 280)
    setAnnouncement(trimmed)
    setSavedAnnouncement(trimmed)
    notify.success(
      trimmed
        ? t("settings.displayAnnouncementSaved", "Announcement saved — it will appear on the TV ticker.")
        : t("settings.displayAnnouncementCleared", "Announcement cleared — default tips will show.")
    )
  }

  const handleClear = async () => {
    if (!activeBranch?.id) return
    setAnnouncement("")
    setSaving(true)
    const { error } = await saveBranchDisplayAnnouncement(activeBranch.id, "")
    setSaving(false)
    if (error) {
      notify.error(error)
      return
    }
    setSavedAnnouncement("")
    notify.success(
      t("settings.displayAnnouncementCleared", "Announcement cleared — default tips will show.")
    )
  }

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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Monitor className="h-4 w-4 text-primary-600" />
                {t("settings.displayUrlTitle", "Display Screen URL")}
              </CardTitle>
              <CardDescription>
                {t(
                  "settings.displayUrlDesc",
                  "Open this URL on your waiting room TV or monitor. No login required."
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                <code className="flex-1 break-all font-mono text-sm text-neutral-700">
                  {displayUrl ?? t("settings.displaySelectBranch", "Select a branch to view display URL")}
                </code>
                {displayUrl ? (
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/display" target="_blank">
                      <ExternalLink className="mr-1 h-3.5 w-3.5" />{" "}
                      {t("settings.displayPreview", "Preview")}
                    </Link>
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-neutral-400">
                {t(
                  "settings.displayRefreshHint",
                  "The display screen auto-refreshes every 10 seconds and reconnects automatically if the network drops."
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-primary-600" />
                {t("settings.displaySectionsTitle", "What Is Displayed")}
              </CardTitle>
              <CardDescription>
                {t("settings.displaySectionsDesc", "Sections shown on the waiting room screen.")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {[
                  {
                    label: t("settings.displaySecNow", "Now Serving"),
                    description: t(
                      "settings.displaySecNowDesc",
                      "Patient currently in chair (first name + queue code)"
                    ),
                    enabled: true,
                  },
                  {
                    label: t("settings.displaySecWaiting", "Waiting List"),
                    description: t(
                      "settings.displaySecWaitingDesc",
                      "Patients waiting, ordered by queue position"
                    ),
                    enabled: true,
                  },
                  {
                    label: t("settings.displaySecClock", "Live Clock"),
                    description: t("settings.displaySecClockDesc", "Current time shown in the corner"),
                    enabled: true,
                  },
                  {
                    label: t("settings.displaySecTicker", "Clinic Announcement Ticker"),
                    description: t(
                      "settings.displaySecTickerDesc",
                      "Scrolling text message at the bottom of the screen"
                    ),
                    enabled: true,
                  },
                ].map((section) => (
                  <li
                    key={section.label}
                    className="flex items-start justify-between gap-4 rounded-lg border border-neutral-100 bg-neutral-50/60 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{section.label}</p>
                      <p className="mt-0.5 text-xs text-neutral-500">{section.description}</p>
                    </div>
                    <Badge variant="success">
                      {section.label === t("settings.displaySecTicker", "Clinic Announcement Ticker") &&
                      !announcementActive
                        ? t("settings.displayDefaults", "Defaults")
                        : t("settings.displayActive", "Active")}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Megaphone className="h-4 w-4 text-primary-600" />
                {t("settings.displayAnnouncementTitle", "Clinic Announcement")}
              </CardTitle>
              <CardDescription>
                {t(
                  "settings.displayAnnouncementDesc",
                  "A scrolling message displayed at the bottom of the waiting room screen. Leave blank to show default tips."
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="h-24 animate-pulse rounded-lg bg-neutral-100" />
              ) : (
                <>
                  <textarea
                    value={announcement}
                    onChange={(e) => setAnnouncement(e.target.value.slice(0, 280))}
                    rows={3}
                    maxLength={280}
                    disabled={!activeBranch?.id || saving}
                    className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:bg-neutral-50"
                    placeholder={t(
                      "settings.displayAnnouncementPlaceholder",
                      'Welcome to our clinic! Please inform the receptionist if your wait exceeds 30 minutes.'
                    )}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-neutral-400">
                      {announcement.length}/280 ·{" "}
                      {t(
                        "settings.displayAnnouncementExample",
                        'Example: "Welcome to {branch}! Please inform the receptionist if your wait exceeds 30 minutes."'
                      ).replace("{branch}", activeBranch?.name ?? "our clinic")}
                    </p>
                    <div className="flex gap-2">
                      {savedAnnouncement ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={saving}
                          onClick={() => void handleClear()}
                        >
                          {t("common.clear", "Clear")}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        disabled={!activeBranch?.id || saving || !dirty}
                        onClick={() => void handleSave()}
                      >
                        {saving ? t("common.saving", "Saving…") : t("common.save", "Save")}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-primary-600" />
                {t("settings.displayPrivacyTitle", "Privacy Rules")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-neutral-700">
                <li>
                  ✓{" "}
                  {t(
                    "settings.displayPrivacy1",
                    "Only queue codes and first names are shown — no full patient names"
                  )}
                </li>
                <li>
                  ✓{" "}
                  {t(
                    "settings.displayPrivacy2",
                    "No medical, financial, or contact information is ever displayed"
                  )}
                </li>
                <li>
                  ✓{" "}
                  {t(
                    "settings.displayPrivacy3",
                    "Screen auto-blanks if no patients are waiting for more than 15 minutes"
                  )}
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </ModulePageShell>
    </PermissionGate>
  )
}
