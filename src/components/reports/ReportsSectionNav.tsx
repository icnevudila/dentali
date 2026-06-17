"use client"

import { cn } from "@/lib/utils"

export type ReportsSectionLink = {
  id: string
  label: string
}

type ReportsSectionNavProps = {
  sections: ReportsSectionLink[]
  className?: string
}

export function ReportsSectionNav({ sections, className }: ReportsSectionNavProps) {
  if (sections.length === 0) return null

  return (
    <nav
      aria-label="Report sections"
      className={cn(
        "sticky top-0 z-20 -mx-1 flex gap-1 overflow-x-auto border-b border-neutral-200/80 bg-white/95 px-1 pb-2 backdrop-blur-sm supports-[backdrop-filter]:bg-white/85",
        className
      )}
    >
      {sections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
        >
          {section.label}
        </a>
      ))}
    </nav>
  )
}
