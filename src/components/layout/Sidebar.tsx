"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ExternalLink, Loader2, Menu, X } from "lucide-react"
import { useBranch } from "@/hooks/use-branch"
import { usePermission } from "@/hooks/use-permission"
import { cn } from "@/lib/utils"
import { useLocale } from "@/hooks/use-locale"
import { buildPublicDeviceUrl, generateBranchPublicToken } from "@/lib/kiosk/kiosk-service"
import { Button } from "@/components/ui/button"
import { DentQLLogo } from "@/components/brand/dentql-logo"
import { notify } from "@/lib/ui/notify"
import {
  APP_NAV_GROUPS,
  defaultNavActive,
  type AppNavItem,
} from "@/lib/navigation/app-nav"

const MobileNavContext = React.createContext<{
  open: boolean
  setOpen: (open: boolean) => void
} | null>(null)

export function useMobileNav() {
  const ctx = React.useContext(MobileNavContext)
  if (!ctx) throw new Error("useMobileNav must be used within MobileNavProvider")
  return ctx
}

export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const pathname = usePathname()

  React.useEffect(() => {
    const id = window.setTimeout(() => setOpen(false), 0)
    return () => window.clearTimeout(id)
  }, [pathname])

  return (
    <MobileNavContext.Provider value={{ open, setOpen }}>
      {children}
      <MobileNavDrawer open={open} onClose={() => setOpen(false)} />
    </MobileNavContext.Provider>
  )
}

export function MobileNavTrigger() {
  const { setOpen } = useMobileNav()
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="md:hidden shrink-0"
      aria-label="Open menu"
      onClick={() => setOpen(true)}
    >
      <Menu className="h-5 w-5" />
    </Button>
  )
}

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: AppNavItem
  pathname: string
  onNavigate?: () => void
}) {
  const { t } = useLocale()
  const { activeBranch } = useBranch()
  const [opening, setOpening] = React.useState(false)
  const isActive = item.isActive ? item.isActive(pathname) : defaultNavActive(pathname, item.href)
  const linkClassName = cn(
    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-primary-50 text-primary-700"
      : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950"
  )

  const handleOpenPublicDevice = async () => {
    if (!item.publicDevice || !activeBranch || opening) return

    setOpening(true)
    const { data, error } = await generateBranchPublicToken(activeBranch.id, item.publicDevice)
    setOpening(false)

    if (error || !data?.token) {
      notify.error(error ?? t("display.linkFailed", "Failed to generate device link"))
      return
    }

    const url = buildPublicDeviceUrl(item.publicDevice, data.token)
    window.open(url, "_blank", "noopener,noreferrer")
    onNavigate?.()
  }

  if (item.publicDevice) {
    return (
      <button
        type="button"
        disabled={!activeBranch || opening}
        onClick={handleOpenPublicDevice}
        className={cn(linkClassName, "disabled:cursor-not-allowed disabled:opacity-60")}
      >
        {opening ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-neutral-500" aria-hidden />
        ) : (
          <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary-600" : "text-neutral-500")} />
        )}
        <span className="flex-1 truncate text-left">{t(item.nameKey, item.fallback)}</span>
        <ExternalLink className="h-3 w-3 shrink-0 text-neutral-400" aria-hidden />
      </button>
    )
  }

  return (
    <Link
      href={item.href}
      target={item.openInNewTab ? "_blank" : undefined}
      rel={item.openInNewTab ? "noopener noreferrer" : undefined}
      onClick={onNavigate}
      className={linkClassName}
    >
      <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary-600" : "text-neutral-500")} />
      <span className="flex-1 truncate">{t(item.nameKey, item.fallback)}</span>
      {item.openInNewTab ? (
        <ExternalLink className="h-3 w-3 shrink-0 text-neutral-400" aria-hidden />
      ) : null}
    </Link>
  )
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? ""
  const { hasPermission, loading } = usePermission()
  const { t } = useLocale()

  return (
    <nav className="flex flex-1 flex-col overflow-y-auto px-3 py-3">
      {APP_NAV_GROUPS.map((group) => {
        const visibleItems = group.items.filter((item) => {
          if (loading) return false
          if (item.anyOf?.length) {
            return item.anyOf.some((key) => hasPermission(key))
          }
          if (!item.permission) return true
          return hasPermission(item.permission)
        })
        if (visibleItems.length === 0) return null

        return (
          <div key={group.id} className="mb-4 last:mb-0">
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              {t(group.labelKey, group.labelFallback)}
            </p>
            <div className="flex flex-col gap-0.5">
              {visibleItems.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        )
      })}
    </nav>
  )
}

function MobileNavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-neutral-950/40"
        aria-label="Close menu"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-xl">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-200 px-4">
          <DentQLLogo href="/" size="sm" />
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close menu">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <SidebarNav onNavigate={onClose} />
      </aside>
    </div>
  )
}

export function Sidebar() {
  return (
    <aside
      className="hidden w-64 shrink-0 border-r border-neutral-200 bg-white md:flex md:flex-col"
      style={{ viewTransitionName: "app-sidebar" } as React.CSSProperties}
    >
      <div className="flex h-16 shrink-0 items-center border-b border-neutral-200 px-6">
        <DentQLLogo href="/" size="sm" />
      </div>
      <SidebarNav />
    </aside>
  )
}
