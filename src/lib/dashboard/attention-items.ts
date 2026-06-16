import type { DashboardStats } from "@/lib/dashboard/dashboard-service"
import { PERMISSIONS } from "@/lib/auth/permissions"
import {
  evaluateAttentionRules,
  type AttentionRuleContext,
} from "@/lib/dashboard/attention-rules"

export type AttentionTone = "amber" | "red" | "sky"

export type AttentionItem = {
  id: string
  label: string
  count: number
  href: string
  tone: AttentionTone
  /** True when linked branch automation is disabled — staff action required */
  automationOff?: boolean
  workflowKey?: string
}

export type AttentionLabels = {
  pendingConsents: string
  pendingIntakeDrafts: string
  appointmentsAwaitingCheckin: string
  queueWaiting: string
  waitlistWaiting: string
  openInvoices: string
  lowStock: string
  missingNotes: string
  overdueInvoices: string
  hmoDraft: string
  philhealthPending: string
  openEncountersStale: string
}

export type BuildAttentionOptions = {
  permissions?: ReadonlySet<string>
  workflowSettings?: Record<string, boolean> | null
}

const PERMISSIVE_PERMISSIONS = new Set<string>([
  PERMISSIONS.PATIENTS_READ,
  PERMISSIONS.APPOINTMENTS_READ,
  PERMISSIONS.QUEUE_MANAGE,
  PERMISSIONS.BILLING_READ,
  PERMISSIONS.HMO_READ,
])

/** Dashboard KPIs → prioritized deep links via declarative rule engine */
export function buildAttentionItems(
  stats: DashboardStats,
  labels: AttentionLabels,
  options: BuildAttentionOptions = {}
): AttentionItem[] {
  const ctx: AttentionRuleContext = {
    stats,
    labels,
    permissions: options.permissions ?? PERMISSIVE_PERMISSIONS,
    workflowSettings: options.workflowSettings ?? null,
  }

  return evaluateAttentionRules(ctx)
}
