"use client"

import * as React from "react"
import { BranchSwitcher } from "./BranchSwitcher"
import { UserAccountMenu } from "./UserAccountMenu"
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher"
import { MobileNavTrigger } from "@/components/layout/Sidebar"

export function Topbar() {
  return (
    <header
      className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-neutral-200 bg-white/95 px-4 backdrop-blur-sm supports-[backdrop-filter]:bg-white/85 sm:h-16 sm:px-6 md:relative md:z-30 md:bg-white"
      style={{ viewTransitionName: "app-topbar" } as React.CSSProperties}
    >
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <MobileNavTrigger />
        <BranchSwitcher />
      </div>
      <div className="flex items-center gap-3">
        <LocaleSwitcher />
        <UserAccountMenu />
      </div>
    </header>
  )
}
