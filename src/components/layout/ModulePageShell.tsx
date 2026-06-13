import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { DirectionalTransition } from "@/components/layout/DirectionalTransition"
import { PageHeader } from "@/components/layout/PageHeader"
import { SectionEyebrow } from "@/components/layout/SectionEyebrow"
import { MetricStrip, type MetricItem } from "@/components/layout/MetricStrip"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ModulePageShellProps = {
  eyebrow: ReactNode
  icon: LucideIcon
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  badges?: ReactNode
  metrics?: MetricItem[]
  metricsClassName?: string
  error?: string | null
  onRetry?: () => void
  retryLabel?: string
  children: ReactNode
  /** Wrap main content in ContentPanel (default true for list pages) */
  panel?: boolean
  panelClassName?: string
  className?: string
  maxWidth?: string
}

export function ModulePageShell({
  eyebrow,
  icon,
  title,
  description,
  actions,
  badges,
  metrics,
  metricsClassName,
  error,
  onRetry,
  retryLabel = "Retry",
  children,
  panel = true,
  panelClassName,
  className,
  maxWidth = "max-w-7xl",
}: ModulePageShellProps) {
  const content = panel ? (
    <ContentPanel className={panelClassName}>{children}</ContentPanel>
  ) : (
    children
  )

  return (
    <DirectionalTransition className={cn("mx-auto w-full", maxWidth, className)} data-print-content="true">
      <div className="space-y-6">
        <SectionEyebrow icon={icon}>{eyebrow}</SectionEyebrow>

        <PageHeader title={title} description={description} actions={actions} />

        {badges}

        {metrics && metrics.length > 0 ? (
          <MetricStrip items={metrics} className={metricsClassName} />
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 animate-fade-rise">
            <p className="text-sm text-red-700">{error}</p>
            {onRetry ? (
              <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
                {retryLabel}
              </Button>
            ) : null}
          </div>
        ) : null}

        {content}
      </div>
    </DirectionalTransition>
  )
}
