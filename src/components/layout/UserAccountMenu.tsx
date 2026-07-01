"use client"

import * as React from "react"
import Link from "next/link"
import { createPortal } from "react-dom"
import { useAuth } from "@/hooks/use-auth"
import { useLocale } from "@/hooks/use-locale"
import {
  fetchMySessionLogs,
  fetchStaffProfile,
  logSessionEvent,
  type SessionAuditEntry,
} from "@/lib/auth/auth-service"
import {
  Bell,
  ChevronDown,
  Clock,
  LogIn,
  LogOut,
  ScrollText,
  Settings,
  User,
} from "lucide-react"
import { usePermission } from "@/hooks/use-permission"
import { cn } from "@/lib/utils"

const MENU_WIDTH = 320
const MENU_Z_BACKDROP = 240
const MENU_Z_PANEL = 250

function formatSessionTime(iso: string): string {
  return new Date(iso).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function sessionEventLabel(
  eventType: string,
  t: (key: string, fallback: string) => string
): string {
  if (eventType === "login") {
    return t("userMenu.sessionLogin", "Signed in")
  }
  if (eventType === "logout") {
    return t("userMenu.sessionLogout", "Signed out")
  }
  return eventType
}

function MenuLink({
  href,
  icon: Icon,
  children,
  onNavigate,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  onNavigate: () => void
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="mx-1.5 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-neutral-700 transition-colors hover:bg-white hover:text-neutral-900"
      onClick={onNavigate}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/80 text-neutral-500 shadow-sm ring-1 ring-neutral-200/80">
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <span className="truncate">{children}</span>
    </Link>
  )
}

export function UserAccountMenu() {
  const { user, signOut } = useAuth()
  const { t } = useLocale()
  const [open, setOpen] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const [menuStyle, setMenuStyle] = React.useState<React.CSSProperties>({})
  const [displayName, setDisplayName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [roleName, setRoleName] = React.useState<string | null>(null)
  const [profileId, setProfileId] = React.useState<string | null>(null)
  const [sessionLogs, setSessionLogs] = React.useState<SessionAuditEntry[]>([])
  const [signingOut, setSigningOut] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!user) return
    void fetchStaffProfile().then((staff) => {
      if (!staff) {
        setDisplayName(user.email?.split("@")[0] ?? "User")
        setEmail(user.email ?? "")
        setProfileId(user.id)
        return
      }
      setProfileId(staff.id)
      setRoleName(staff.role_name)
      setEmail(staff.email ?? user.email ?? "")
      if (staff.full_name) setDisplayName(staff.full_name)
      else if (staff.email) setDisplayName(staff.email.split("@")[0])
      else setDisplayName(user.email?.split("@")[0] ?? "User")
    })
  }, [user])

  React.useEffect(() => {
    if (!open || !user) return
    void fetchMySessionLogs(5).then(({ data }) => setSessionLogs(data))
  }, [open, user])

  const updateMenuPosition = React.useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const margin = 8
    let left = rect.right - MENU_WIDTH
    left = Math.max(margin, Math.min(left, window.innerWidth - MENU_WIDTH - margin))

    const belowTop = rect.bottom + 8
    const menuHeightEstimate = 420
    const top =
      belowTop + menuHeightEstimate > window.innerHeight - margin
        ? Math.max(margin, rect.top - menuHeightEstimate - 8)
        : belowTop

    setMenuStyle({
      position: "fixed",
      top,
      left,
      width: MENU_WIDTH,
      zIndex: MENU_Z_PANEL,
    })
  }, [])

  React.useLayoutEffect(() => {
    if (!open) return
    updateMenuPosition()
    window.addEventListener("resize", updateMenuPosition)
    window.addEventListener("scroll", updateMenuPosition, true)
    return () => {
      window.removeEventListener("resize", updateMenuPosition)
      window.removeEventListener("scroll", updateMenuPosition, true)
    }
  }, [open, updateMenuPosition])

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  const handleSignOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    setOpen(false)
    try {
      await logSessionEvent("logout")
    } catch {
      // Audit log failure must not block sign-out.
    }
    await signOut()
    setSigningOut(false)
  }

  if (!user) return null

  const initials = displayName.slice(0, 2).toUpperCase()
  const lastLogin = sessionLogs.find((log) => log.event_type === "login")
  const close = () => setOpen(false)

  const { hasPermission } = usePermission()
  const isManager = roleName === "owner" || roleName === "admin" || hasPermission("settings.write")

  const menuPortal =
    open && mounted ? (
      <>
        <button
          type="button"
          className="fixed inset-0 cursor-default bg-neutral-900/30 backdrop-blur-[1px]"
          style={{ zIndex: MENU_Z_BACKDROP }}
          aria-label={t("common.close", "Close")}
          onClick={close}
        />
        <div
          role="menu"
          style={menuStyle}
          className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-neutral-50 shadow-xl shadow-neutral-900/15 ring-1 ring-black/5 animate-fade-rise"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-neutral-200/80 bg-gradient-to-br from-primary-50 via-white to-neutral-50 px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-sm font-bold text-white shadow-md">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900">{displayName}</p>
                <p className="truncate text-xs text-neutral-500">{email}</p>
                {roleName ? (
                  <span className="mt-2 inline-flex rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-800">
                    {roleName}
                  </span>
                ) : null}
              </div>
            </div>
            {lastLogin ? (
              <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-white/70 px-2.5 py-1.5 text-xs text-neutral-600 ring-1 ring-neutral-200/70">
                <Clock className="h-3.5 w-3.5 shrink-0 text-primary-600" aria-hidden />
                <span>
                  {t("userMenu.lastLogin", "Last sign-in")}: {formatSessionTime(lastLogin.created_at)}
                </span>
              </p>
            ) : null}
          </div>

          {sessionLogs.length > 0 ? (
            <div className="border-b border-neutral-200/80 bg-neutral-100/60 px-3 py-3">
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                {t("userMenu.recentActivity", "Recent activity")}
              </p>
              <ul className="max-h-32 space-y-1 overflow-y-auto rounded-xl bg-white/80 p-2 ring-1 ring-neutral-200/70">
                {sessionLogs.map((log) => (
                  <li
                    key={log.id}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs text-neutral-600"
                  >
                    <span className="flex min-w-0 items-center gap-1.5 truncate">
                      {log.event_type === "login" ? (
                        <LogIn className="h-3 w-3 shrink-0 text-emerald-600" aria-hidden />
                      ) : (
                        <LogOut className="h-3 w-3 shrink-0 text-neutral-400" aria-hidden />
                      )}
                      {sessionEventLabel(log.event_type, t)}
                    </span>
                    <time className="shrink-0 tabular-nums text-neutral-400">
                      {formatSessionTime(log.created_at)}
                    </time>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="space-y-0.5 bg-neutral-50 px-1.5 py-2">
            {profileId ? (
              <MenuLink href={`/settings/staff/${profileId}`} icon={User} onNavigate={close}>
                {t("userMenu.myProfile", "My profile")}
              </MenuLink>
            ) : null}
            {isManager && (
              <MenuLink href="/settings/organization" icon={Settings} onNavigate={close}>
                {t("userMenu.settings", "Settings")}
              </MenuLink>
            )}
            <MenuLink href="/settings/notifications" icon={Bell} onNavigate={close}>
              {t("userMenu.notifications", "Notifications")}
            </MenuLink>
            {isManager && (
              <MenuLink href="/settings/audit?source=session" icon={ScrollText} onNavigate={close}>
                {t("userMenu.activityLog", "Activity log")}
              </MenuLink>
            )}
          </div>

          <div className="border-t border-neutral-200/80 bg-white px-1.5 py-2">
            <button
              type="button"
              role="menuitem"
              disabled={signingOut}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
              onClick={() => void handleSignOut()}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-600 ring-1 ring-red-100">
                <LogOut className="h-3.5 w-3.5" aria-hidden />
              </span>
              {signingOut ? t("common.signingOut", "Signing out…") : t("common.signOut", "Sign out")}
            </button>
          </div>
        </div>
      </>
    ) : null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative z-[1] flex items-center gap-2 rounded-xl border border-neutral-200/80 bg-white/70 px-2 py-1 shadow-sm transition-colors hover:bg-white",
          open && "border-primary-200 bg-white ring-2 ring-primary-100"
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("userMenu.open", "Open account menu")}
      >
        <span className="hidden max-w-[10rem] truncate text-sm font-medium text-neutral-700 sm:inline">
          {displayName}
        </span>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-sm font-semibold text-white shadow-sm">
          {initials}
        </div>
        <ChevronDown
          className={cn("hidden h-4 w-4 text-neutral-400 transition-transform sm:block", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {mounted && menuPortal ? createPortal(menuPortal, document.body) : null}
    </>
  )
}
