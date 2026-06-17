"use client"

import { cn } from "@/lib/utils"

export type ReportsSectionLink = {
  id: string
  label: string
}

export type ReportsSectionGroup = {
  label?: string
  sections: ReportsSectionLink[]
}

type ReportsSectionNavProps = {
  groups: ReportsSectionGroup[]
  activeId: string
  onSelect: (id: string) => void
  className?: string
}

export function ReportsSectionNav({
  groups,
  activeId,
  onSelect,
  className,
}: ReportsSectionNavProps) {
  const flat = groups.flatMap((group) => group.sections)
  if (flat.length === 0) return null

  return (
    <nav
      aria-label="Report sections"
      className={cn(
        "sticky top-0 z-20 -mx-1 space-y-2 border-b border-neutral-200/80 bg-white/95 px-1 pb-3 backdrop-blur-sm supports-[backdrop-filter]:bg-white/85",
        className
      )}
    >
      {groups.map((group) => (
        <div key={group.label ?? group.sections.map((s) => s.id).join("-")} className="space-y-1.5">
          {group.label ? (
            <p className="px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400">
              {group.label}
            </p>
          ) : null}
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {group.sections.map((section) => {
              const active = section.id === activeId
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => onSelect(section.id)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30",
                    active
                      ? "bg-primary-600 text-white shadow-sm"
                      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                  )}
                >
                  {section.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}
