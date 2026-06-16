"use client"

import Link from "next/link"
import { ArrowRight, Settings } from "lucide-react"
import { SETTINGS_NAV_GROUPS } from "@/lib/navigation/app-nav"
import { useLocale } from "@/hooks/use-locale"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

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
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-700 transition-colors hover:border-primary-200 hover:bg-primary-50/40 hover:text-neutral-950"
                >
                  <span>{t(item.key, item.fallback)}</span>
                  <ArrowRight className="h-4 w-4 text-neutral-400" aria-hidden />
                </Link>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </ModulePageShell>
  )
}
