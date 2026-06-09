import * as React from "react"
import Link from "next/link"
import { Home, Users, Calendar, CreditCard, Settings, UserPlus } from "lucide-react"

const NAV_ITEMS = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Patients", href: "/patients", icon: Users },
  { name: "Appointments", href: "/appointments", icon: Calendar },
  { name: "Billing", href: "/billing", icon: CreditCard },
  { name: "Staff & Team", href: "/settings/staff", icon: UserPlus },
  { name: "Settings", href: "/settings/organization", icon: Settings },
]

export function Sidebar() {
  return (
    <aside className="w-64 border-r border-neutral-200 bg-white hidden md:flex md:flex-col">
      <div className="flex h-16 shrink-0 items-center border-b border-neutral-200 px-6">
        <span className="text-xl font-bold text-primary-600">dentali.</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950 transition-colors"
          >
            <item.icon className="h-5 w-5 text-neutral-500" />
            {item.name}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
