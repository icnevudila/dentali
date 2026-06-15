"use client"

import * as React from "react"
import Link from "next/link"
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
import { cn } from "@/lib/utils"

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

export function UserAccountMenu() {
  const { user, signOut } = useAuth()
  const { t } = useLocale()
  const [open, setOpen] = React.useState(false)
  const [displayName, setDisplayName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [roleName, setRoleName] = React.useState<string | null>(null)
  const [profileId, setProfileId] = React.useState<string | null>(null)
  const [sessionLogs, setSessionLogs] = React.useState<SessionAuditEntry[]>([])

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

  const handleSignOut = async () => {
    setOpen(false)
    await logSessionEvent("logout")
    await signOut()
  }

  if (!user) return null

  const initials = displayName.slice(0, 2).toUpperCase()
  const lastLogin = sessionLogs.find((log) => log.event_type === "login")

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 rounded-lg border border-transparent px-1.5 py-1 transition-colors hover:bg-neutral-100",
          open && "bg-neutral-100"
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("userMenu.open", "Open account menu")}
      >
        <span className="hidden max-w-[10rem] truncate text-sm text-neutral-700 sm:inline">
          {displayName}
        </span>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
          {initials}
        </div>
        <ChevronDown
          className={cn("hidden h-4 w-4 text-neutral-400 transition-transform sm:block", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            aria-label={t("common.close", "Close")}
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-1.5 w-[min(100vw-2rem,18rem)] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg"
          >
            <div className="border-b border-neutral-100 px-4 py-3">
              <p className="truncate text-sm font-semibold text-neutral-900">{displayName}</p>
              <p className="truncate text-xs text-neutral-500">{email}</p>
              {roleName ? (
                <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-primary-700">
                  {roleName}
                </p>
              ) : null}
              {lastLogin ? (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500">
                  <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>
                    {t("userMenu.lastLogin", "Last sign-in")}: {formatSessionTime(lastLogin.created_at)}
                  </span>
                </p>
              ) : null}
            </div>

            {sessionLogs.length > 0 ? (
              <div className="border-b border-neutral-100 px-4 py-2.5">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                  {t("userMenu.recentActivity", "Recent activity")}
                </p>
                <ul className="space-y-1">
                  {sessionLogs.map((log) => (
                    <li
                      key={log.id}
                      className="flex items-center justify-between gap-2 text-xs text-neutral-600"
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

            <div className="py-1">
              {profileId ? (
                <Link
                  href={`/settings/staff/${profileId}`}
                  role="menuitem"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                  onClick={() => setOpen(false)}
                >
                  <User className="h-4 w-4 text-neutral-400" aria-hidden />
                  {t("userMenu.myProfile", "My profile")}
                </Link>
              ) : null}
              <Link
                href="/settings/organization"
                role="menuitem"
                className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                onClick={() => setOpen(false)}
              >
                <Settings className="h-4 w-4 text-neutral-400" aria-hidden />
                {t("userMenu.settings", "Settings")}
              </Link>
              <Link
                href="/settings/notifications"
                role="menuitem"
                className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                onClick={() => setOpen(false)}
              >
                <Bell className="h-4 w-4 text-neutral-400" aria-hidden />
                {t("userMenu.notifications", "Notifications")}
              </Link>
              <Link
                href="/settings/audit?source=session"
                role="menuitem"
                className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                onClick={() => setOpen(false)}
              >
                <ScrollText className="h-4 w-4 text-neutral-400" aria-hidden />
                {t("userMenu.activityLog", "Activity log")}
              </Link>
            </div>

            <div className="border-t border-neutral-100 py-1">
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                onClick={() => void handleSignOut()}
              >
                <LogOut className="h-4 w-4" aria-hidden />
                {t("common.signOut", "Sign out")}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
