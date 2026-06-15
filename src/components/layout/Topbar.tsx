"use client"

import * as React from "react"
import { BranchSwitcher } from "./BranchSwitcher"
import { UserAccountMenu } from "./UserAccountMenu"
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher"
import { MobileNavTrigger } from "@/components/layout/Sidebar"

export function Topbar() {
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
        <UserAccountMenu />
      </div>
    </header>
  )
}
