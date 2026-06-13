"use client"

import * as React from "react"
import { BranchSwitcher } from "./BranchSwitcher"
import { useAuth } from "@/hooks/use-auth"
import { fetchStaffProfile, logSessionEvent } from "@/lib/auth/auth-service"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher"
import { MobileNavTrigger } from "@/components/layout/Sidebar"
import { useLocale } from "@/hooks/use-locale"

export function Topbar() {
  const { user, signOut } = useAuth()
  const { t } = useLocale()
  const [displayName, setDisplayName] = React.useState("")

  React.useEffect(() => {
    if (!user) return
    fetchStaffProfile().then((staff) => {
      if (staff?.full_name) setDisplayName(staff.full_name)
      else if (staff?.email) setDisplayName(staff.email.split("@")[0])
      else setDisplayName(user.email?.split("@")[0] ?? "User")
    })
  }, [user])

  const handleSignOut = async () => {
    await logSessionEvent("logout")
    await signOut()
  }

  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <header
      className="flex h-14 sm:h-16 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4 sm:px-6 gap-2"
      style={{ viewTransitionName: "app-topbar" } as React.CSSProperties}
    >
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <MobileNavTrigger />
        <BranchSwitcher />
      </div>
      <div className="flex items-center gap-3">
        <LocaleSwitcher />
        <span className="hidden text-sm text-neutral-600 sm:inline">{displayName}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
          {initials}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="gap-1 text-neutral-600"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">{t("common.signOut", "Sign out")}</span>
        </Button>
      </div>
    </header>
  )
}
