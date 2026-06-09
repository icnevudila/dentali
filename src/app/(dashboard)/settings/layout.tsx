"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const SETTINGS_NAV = [
  { name: "Organization", href: "/settings/organization" },
  { name: "Branches", href: "/settings/branches" },
  { name: "Staff & Team", href: "/settings/staff" },
  { name: "Roles & Permissions", href: "/settings/roles" },
  { name: "Procedures", href: "/settings/procedures" },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-950">Settings</h1>
        <p className="text-sm text-neutral-500">Manage your clinic preferences, staff, and branches.</p>
      </div>
      
      <div className="flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-56 shrink-0">
          <nav className="flex flex-col space-y-1">
            {SETTINGS_NAV.map((item) => {
              const isActive = pathname?.startsWith(item.href)
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    isActive 
                      ? "bg-primary-50 text-primary-700" 
                      : "text-neutral-700 hover:bg-neutral-100"
                  )}
                >
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </aside>
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  )
}
