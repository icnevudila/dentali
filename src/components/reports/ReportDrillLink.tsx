"use client"

import Link from "next/link"
import { ArrowRight, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NAV_FORWARD_TRANSITION } from "@/lib/navigation/view-transition"
import { cn } from "@/lib/utils"

type ReportDrillLinkProps = {
  title: string
  description: string
  href: string
  linkLabel: string
  className?: string
}

export function ReportDrillLink({
  title,
  description,
  href,
  linkLabel,
  className,
}: ReportDrillLinkProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-neutral-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-50 text-neutral-500">
          <BarChart3 className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-neutral-950">{title}</p>
          <p className="text-xs text-neutral-500">{description}</p>
        </div>
      </div>
      <Button variant="outline" size="sm" className="shrink-0 gap-1.5" asChild>
        <Link href={href} transitionTypes={NAV_FORWARD_TRANSITION}>
          {linkLabel}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </Button>
    </div>
  )
}
