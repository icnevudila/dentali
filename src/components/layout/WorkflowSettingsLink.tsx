"use client"

import Link from "next/link"
import { Settings2 } from "lucide-react"
import { useLocale } from "@/hooks/use-locale"
import { cn } from "@/lib/utils"

/** Inline chip linking to branch workflow automation toggles. */
export function WorkflowSettingsLink({ className }: { className?: string }) {
  const { t } = useLocale()

  return (
    <Link
      href="/settings/workflow"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-600 shadow-sm transition-colors hover:border-primary-200 hover:text-primary-700",
        className
      )}
    >
      <Settings2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">{t("workflow.automationSettings", "Automation settings")}</span>
    </Link>
  )
}
