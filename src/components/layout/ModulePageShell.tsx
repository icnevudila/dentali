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
  /** Detailed day/module summary grid — above metrics by default */
  summary?: ReactNode
  metrics?: MetricItem[]
  metricsClassName?: string
  error?: string | null
  onRetry?: () => void
  /** @deprecated PageErrorNotifier uses toast only; kept for call-site compat */
  retryLabel?: string
  children: ReactNode
  /** Wrap main content in ContentPanel (default true for list pages) */
  panel?: boolean
  panelClassName?: string
  className?: string
  maxWidth?: string
  /** Shorter title; hide description on small screens */
  compactHeader?: boolean
  /** Hide module eyebrow on mobile */
  hideEyebrowOnMobile?: boolean
  /** Render summary + metrics after main content (board/list first) */
  summaryBelowContent?: boolean
  /** Extra blocks after summary/metrics (reports links, guides) */
  belowContent?: ReactNode
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
  retryLabel: _retryLabel,
  children,
  panel = true,
  panelClassName,
  className,
  maxWidth = "max-w-7xl",
  compactHeader = false,
  hideEyebrowOnMobile = false,
  summaryBelowContent = false,
  belowContent,
}: ModulePageShellProps) {
  const content = panel ? (
    <ContentPanel className={panelClassName}>{children}</ContentPanel>
  ) : (
    children
  )

  const summaryBlock = summary ? <div>{summary}</div> : null
  const metricsBlock =
    metrics && metrics.length > 0 ? (
      <MetricStrip items={metrics} className={metricsClassName} />
    ) : null
  const secondaryChrome = (
    <>
      {summaryBlock}
      {metricsBlock}
    </>
  )

  return (
    <DirectionalTransition
      className={cn("mx-auto w-full min-w-0 max-w-full overflow-x-hidden", maxWidth, className)}
      data-print-content="true"
    >
      <div className="min-w-0 space-y-6">
        <SectionEyebrow icon={icon} hideOnMobile={hideEyebrowOnMobile}>
          {eyebrow}
        </SectionEyebrow>

        <PageHeader
          title={title}
          description={description}
          actions={actions}
          compact={compactHeader}
        />

        {badges}

        {!summaryBelowContent ? secondaryChrome : null}

        <PageErrorNotifier error={error} onRetry={onRetry} />

        {content}

        {summaryBelowContent ? secondaryChrome : null}

        {belowContent}
      </div>
    </DirectionalTransition>
  )
}
