"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useLocale } from "@/hooks/use-locale"
import { SETTINGS_NAV_GROUPS } from "@/lib/navigation/app-nav"
import { SectionEyebrow } from "@/components/layout/SectionEyebrow"
import { Settings } from "lucide-react"

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { t } = useLocale()

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 animate-page-enter">
      <div className="space-y-2">
        <SectionEyebrow icon={Settings}>
          {t("settings.eyebrow", "Administration")} · {t("settings.title", "Settings")}
        </SectionEyebrow>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-950">
          {t("settings.title", "Settings")}
        </h1>
        <p className="text-sm text-neutral-500">
          {t("settings.subtitle", "Manage your clinic preferences, staff, and branches.")}
        </p>
      </div>

      <div className="flex flex-col gap-8 md:flex-row">
        <aside className="w-full shrink-0 md:w-56">
          <nav className="flex flex-col gap-6">
            {SETTINGS_NAV_GROUPS.map((group) => (
              <div key={group.labelKey}>
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  {t(group.labelKey, group.labelFallback)}
                </p>
                <div className="flex flex-col space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = pathname?.startsWith(item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-primary-50 text-primary-700"
                            : "text-neutral-700 hover:bg-neutral-100"
                        )}
                      >
                        {t(item.key, item.fallback)}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
