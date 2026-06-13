"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

export type ReportLink = {
  title: string
  description: string
  href: string
  icon: LucideIcon
}

export function ReportQuickLinks({ links }: { links: ReportLink[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {links.map((link) => {
        const Icon = link.icon
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "group rounded-xl border border-neutral-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]",
              "transition-shadow hover:border-primary-200 hover:shadow-[0_2px_8px_rgba(15,23,42,0.05)]"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <ArrowRight className="h-4 w-4 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-500" />
            </div>
            <p className="mt-3 text-sm font-semibold text-neutral-900">{link.title}</p>
            <p className="mt-1 text-xs text-neutral-500">{link.description}</p>
          </Link>
        )
      })}
    </div>
  )
}
