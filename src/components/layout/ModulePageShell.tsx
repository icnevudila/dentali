import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { DirectionalTransition } from "@/components/layout/DirectionalTransition"
import { PageHeader } from "@/components/layout/PageHeader"
import { SectionEyebrow } from "@/components/layout/SectionEyebrow"
import { MetricStrip, type MetricItem } from "@/components/layout/MetricStrip"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { PageErrorNotifier } from "@/components/ui/PageErrorNotifier"
import { cn } from "@/lib/utils"

type ModulePageShellProps = {
  eyebrow: ReactNode
  icon: LucideIcon
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  badges?: ReactNode
  /** Detailed day/module summary grid — shown above the slim metric strip */
  summary?: ReactNode
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
  summary,
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
    <DirectionalTransition
      className={cn("mx-auto w-full min-w-0 max-w-full overflow-x-hidden", maxWidth, className)}
      data-print-content="true"
    >
      <div className="space-y-6">
        <SectionEyebrow icon={icon}>{eyebrow}</SectionEyebrow>

        <PageHeader title={title} description={description} actions={actions} />

        {badges}

        {summary}

        {metrics && metrics.length > 0 ? (
          <MetricStrip items={metrics} className={metricsClassName} />
        ) : null}

        <PageErrorNotifier error={error} onRetry={onRetry} />

        {content}
      </div>
    </DirectionalTransition>
  )
}
