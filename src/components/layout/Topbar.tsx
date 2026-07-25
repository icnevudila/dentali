"use client"

import * as React from "react"
import { BranchSwitcher } from "./BranchSwitcher"
import { UserAccountMenu } from "./UserAccountMenu"
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher"
import { MobileNavTrigger } from "@/components/layout/Sidebar"

import { Search, Command } from "lucide-react"
import { CommandPalette } from "./CommandPalette"

export function Topbar() {
  return (
    <>
      <CommandPalette />
      <header
        className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-neutral-200 bg-white/95 px-4 backdrop-blur-sm supports-[backdrop-filter]:bg-white/85 sm:h-16 sm:px-6 md:relative md:z-30 md:bg-white"
        style={{ viewTransitionName: "app-topbar" } as React.CSSProperties}
      >
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <MobileNavTrigger />
          <BranchSwitcher />
        </div>

        {/* Ctrl+K Command Palette Spotlight Search Button */}
        <button
          onClick={() => {
            const event = new KeyboardEvent("keydown", { key: "k", ctrlKey: true })
            window.dispatchEvent(event)
          }}
          className="hidden sm:flex items-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 px-3 py-1.5 text-xs text-slate-500 transition-all border border-slate-200/80 shrink-0"
        >
          <Search className="h-3.5 w-3.5 text-teal-600" />
          <span className="font-medium">Akıllı Arama & Hızlı İşlem...</span>
          <kbd className="inline-flex items-center gap-0.5 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200 shadow-2xs">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </button>

        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          <UserAccountMenu />
        </div>
      </header>
    </>
  )
}
