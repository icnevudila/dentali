"use client"

import Link from "next/link"
import { ArrowRight, Settings } from "lucide-react"
import { SETTINGS_NAV_GROUPS } from "@/lib/navigation/app-nav"
import { useLocale } from "@/hooks/use-locale"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const HUB_ITEM_HINTS: Record<string, { key: string; fallback: string }> = {
  "/settings/organization": {
    key: "settings.hubHintOrganization",
    fallback: "Clinic profile, branding, and print footer",
  },
  "/settings/branches": {
    key: "settings.hubHintBranches",
    fallback: "Locations, hours, and review links",
  },
  "/settings/procedures": {
    key: "settings.hubHintProcedures",
    fallback: "Fee schedule and procedure BOM links",
  },
  "/settings/hmo-providers": {
    key: "settings.hubHintHmo",
    fallback: "HMO payer codes used on claims",
  },
  "/settings/staff": {
    key: "settings.hubHintStaff",
    fallback: "Team roster, invites, and branch access",
  },
  "/settings/roles": {
    key: "settings.hubHintRoles",
    fallback: "Permission packs by role",
  },
  "/settings/security": {
    key: "settings.hubHintSecurity",
    fallback: "Password, MFA, and your session history",
  },
  "/settings/notifications": {
    key: "settings.hubHintNotifications",
    fallback: "SMS templates and cron readiness",
  },
  "/settings/consent-templates": {
    key: "settings.hubHintConsent",
    fallback: "Forms patients sign at intake or chair",
  },
  "/settings/audit": {
    key: "settings.hubHintAudit",
    fallback: "Compliance trail and CSV export",
  },
  "/settings/workflow": {
    key: "settings.hubHintWorkflow",
    fallback: "Branch automation rules (honest live vs planned)",
  },
  "/settings/kiosk": {
    key: "settings.hubHintKiosk",
    fallback: "Self check-in device settings",
  },
  "/settings/display": {
    key: "settings.hubHintDisplay",
    fallback: "Waiting-room TV queue board",
  },
}

export default function SettingsIndexPage() {
  const { t } = useLocale()

  return (
    <ModulePageShell
      icon={Settings}
      eyebrow={t("settings.eyebrow", "Administration")}
      title={t("settings.title", "Settings")}
      description={t(
        "settings.hubSubtitle",
        "Open the admin modules for clinic profile, branches, staff, permissions, messaging, consent templates, audit, and workflow automation."
      )}
      panel={false}
      maxWidth=""
      className="w-full"
    >
      <div className="grid gap-4 xl:grid-cols-3">
        {SETTINGS_NAV_GROUPS.map((group) => (
          <Card key={group.labelKey}>
            <CardHeader>
              <CardTitle className="text-base">
                {t(group.labelKey, group.labelFallback)}
              </CardTitle>
              <CardDescription>
                {group.items.length} {t("settings.hubModules", "modules")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {group.items.map((item) => {
                const hint = HUB_ITEM_HINTS[item.href]
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-start justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2.5 text-sm text-neutral-700 transition-colors hover:border-primary-200 hover:bg-primary-50/40 hover:text-neutral-950"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{t(item.key, item.fallback)}</span>
                      {hint ? (
                        <span className="mt-0.5 block text-xs text-neutral-500">
                          {t(hint.key, hint.fallback)}
                        </span>
                      ) : null}
                    </span>
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                  </Link>
                )
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </ModulePageShell>
  )
}
