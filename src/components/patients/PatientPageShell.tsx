import type { ReactNode } from "react"
import { Users } from "lucide-react"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import type { MetricItem } from "@/components/layout/MetricStrip"
import { BackToPatientProfile } from "@/components/patients/BackToPatientProfile"

type PatientPageShellProps = {
  patientId: string
  /** When set, shows a contextual back (e.g. chart) under the sticky profile bar. */
  backHref?: string
  backLabel?: string
  /** Sticky layout already shows profile return — hide inline duplicate by default. */
  showInlineBack?: boolean
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
  backLabel,
  showInlineBack = false,
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
  const showBack = showInlineBack || Boolean(backHref)

  return (
    <div className="space-y-3">
      {showBack ? (
        <div className="animate-fade-in print:hidden">
          <BackToPatientProfile
            patientId={patientId}
            href={backHref}
            label={backLabel}
            variant={backHref ? "link" : "button"}
          />
        </div>
      ) : null}

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
