"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useLocale } from "@/hooks/use-locale"
import { usePermission } from "@/hooks/use-permission"
import type { PermissionKey } from "@/lib/auth/permissions"
import { defaultNavActive } from "@/lib/navigation/app-nav"

export type SubNavTab = {
  key: string
  fallback: string
  href: string
  permission?: PermissionKey
  isActive?: (pathname: string) => boolean
}

export function SubNavTabs({ tabs }: { tabs: readonly SubNavTab[] }) {
  const pathname = usePathname()
  const { t } = useLocale()
  const { hasPermission, loading } = usePermission()

  const visible = tabs.filter((tab) => {
    if (loading || !tab.permission) return true
    return hasPermission(tab.permission)
  })

  if (visible.length <= 1) return null

  return (
    <nav
      className="flex flex-wrap gap-1 border-b border-neutral-200 pb-px"
      aria-label="Section navigation"
    >
      {visible.map((tab) => {
        const active = tab.isActive
          ? tab.isActive(pathname ?? "")
          : defaultNavActive(pathname ?? "", tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "relative px-3 py-2 text-sm font-medium transition-colors -mb-px",
              active
                ? "text-primary-700 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary-600 after:rounded-full"
                : "text-neutral-600 hover:text-neutral-950"
            )}
          >
            {t(tab.key, tab.fallback)}
          </Link>
        )
      })}
    </nav>
  )
}
