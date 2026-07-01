import type { ReactNode } from "react"
import Link from "next/link"
import { NAV_BACK_TRANSITION } from "@/lib/navigation/view-transition"
import { ArrowLeft, Users } from "lucide-react"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { Button } from "@/components/ui/button"
import type { MetricItem } from "@/components/layout/MetricStrip"

type PatientPageShellProps = {
  patientId: string
  backHref?: string
  section: string
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  badges?: ReactNode
  metrics?: MetricItem[]
  error?: string | null
  onRetry?: () => void
  retryLabel?: string
  children: ReactNode
  panel?: boolean
  panelClassName?: string
  maxWidth?: string
  className?: string
}

export function PatientPageShell({
  patientId,
  backHref,
  section,
  title,
  description,
  actions,
  badges,
  metrics,
  error,
  onRetry,
  retryLabel,
  children,
  panel = true,
  panelClassName,
  maxWidth = "max-w-5xl",
  className,
}: PatientPageShellProps) {
  return (
    <div className="space-y-3">
      {/* Prominent Back to Profile Link at Top Left */}
      <div className="animate-fade-in">
        <Link
          href={backHref ?? `/patients/${patientId}`}
          transitionTypes={NAV_BACK_TRANSITION}
          className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-primary-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Patient Profile</span>
        </Link>
      </div>

      <ModulePageShell
        icon={Users}
        eyebrow={`Clinical · ${section}`}
        title={title}
        description={description}
        badges={badges}
        metrics={metrics}
        error={error}
        onRetry={onRetry}
        retryLabel={retryLabel}
        panel={panel}
        panelClassName={panelClassName}
        maxWidth={maxWidth}
        className={className}
        actions={actions}
      >
        {children}
      </ModulePageShell>
    </div>
  )
}
