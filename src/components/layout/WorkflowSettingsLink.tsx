import Link from "next/link"
import { Settings2 } from "lucide-react"
import { cn } from "@/lib/utils"

/** Inline chip linking to branch workflow automation toggles. */
export function WorkflowSettingsLink({ className }: { className?: string }) {
  return (
    <Link
      href="/settings/workflow"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-600 shadow-sm transition-colors hover:border-primary-200 hover:text-primary-700",
        className
      )}
    >
      <Settings2 className="h-3.5 w-3.5" aria-hidden />
      Automation settings
    </Link>
  )
}
