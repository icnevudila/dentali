"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Sidebar, MobileNavProvider } from "@/components/layout/Sidebar"
import { Topbar } from "@/components/layout/Topbar"

export function ShowcaseAppChrome({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <MobileNavProvider>
      <div className={cn("flex min-h-[720px] w-full min-w-[1024px] bg-neutral-50", className)}>
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-hidden p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </MobileNavProvider>
  )
}
