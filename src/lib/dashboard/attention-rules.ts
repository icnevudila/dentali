import { PERMISSIONS } from "@/lib/auth/permissions"
import type { DashboardStats } from "@/lib/dashboard/dashboard-service"
import type { AttentionItem, AttentionLabels, AttentionTone } from "@/lib/dashboard/attention-items"

export type AttentionRuleContext = {
  stats: DashboardStats
  labels: AttentionLabels
  /** Permission keys the current user holds for the active branch */
  permissions: ReadonlySet<string>
  /** Branch workflow toggles; null while loading — rules still run, hints omitted */
  workflowSettings: Record<string, boolean> | null
}

type AttentionRuleDef = {
  id: string
  statKey: keyof DashboardStats
  labelKey: keyof AttentionLabels
  href: string
  tone: AttentionTone
  priority: number
  permission?: string
  /** Count at or above this value escalates tone (e.g. queue backlog) */
  escalateAt?: number
  escalateTo?: AttentionTone
  /** Linked workflow toggle — surfaces manual-action hint when automation is off */
  workflowKey?: string
  /** Branch setting key — when false, rule is hidden from Needs attention */
  settingsKey?: string
}

/** Branch workflow JSON key for showing/hiding an attention rule (default: shown) */
export function attentionShowKey(ruleId: string): string {
  return `attention_show_${ruleId}`
}

export type AttentionRuleMeta = Pick<
  AttentionRuleDef,
  "id" | "labelKey" | "settingsKey" | "workflowKey"
>

const TONE_PRIORITY: Record<AttentionTone, number> = {
  red: 0,
  amber: 1,
  sky: 2,
}

/** Declarative attention rules — evaluated in order, filtered by permission & count */
export const ATTENTION_RULES: AttentionRuleDef[] = [
  {
    id: "overdue_invoices",
    statKey: "overdue_invoices",
    labelKey: "overdueInvoices",
    href: "/billing?focus=overdue",
    tone: "red",
    priority: 0,
    permission: PERMISSIONS.BILLING_READ,
    workflowKey: "auto_payment_reminder",
    settingsKey: attentionShowKey("overdue_invoices"),
    escalateAt: 3,
  },
  {
    id: "low_stock",
    statKey: "low_stock_items",
    labelKey: "lowStock",
    href: "/inventory?alerts=1",
    tone: "red",
    priority: 1,
    settingsKey: attentionShowKey("low_stock"),
    escalateAt: 5,
  },
  {
    id: "pending_consents",
    statKey: "pending_consents",
    labelKey: "pendingConsents",
    href: "/patients?attention=consents",
    tone: "amber",
    priority: 2,
    permission: PERMISSIONS.PATIENTS_READ,
    workflowKey: "consent_gate_checkin",
    settingsKey: attentionShowKey("pending_consents"),
  },
  {
    id: "pending_intake_drafts",
    statKey: "pending_intake_drafts",
    labelKey: "pendingIntakeDrafts",
    href: "/patients?attention=intake",
    tone: "amber",
    priority: 3,
    permission: PERMISSIONS.PATIENTS_READ,
    settingsKey: attentionShowKey("pending_intake_drafts"),
  },
  {
    id: "appointments_awaiting_checkin",
    statKey: "appointments_awaiting_checkin",
    labelKey: "appointmentsAwaitingCheckin",
    href: "/appointments",
    tone: "sky",
    priority: 4,
    permission: PERMISSIONS.APPOINTMENTS_READ,
    workflowKey: "auto_checkin_updates_appointment",
    settingsKey: attentionShowKey("appointments_awaiting_checkin"),
  },
  {
    id: "missing_notes",
    statKey: "missing_clinical_notes",
    labelKey: "missingNotes",
    href: "/appointments?focus=missing-notes",
    tone: "amber",
    priority: 5,
    permission: PERMISSIONS.APPOINTMENTS_READ,
    workflowKey: "auto_served_completes_appointment",
    settingsKey: attentionShowKey("missing_notes"),
  },
  {
    id: "open_invoices",
    statKey: "open_invoices",
    labelKey: "openInvoices",
    href: "/billing?focus=open",
    tone: "amber",
    priority: 6,
    permission: PERMISSIONS.BILLING_READ,
    workflowKey: "auto_approve_creates_invoice",
    settingsKey: attentionShowKey("open_invoices"),
  },
  {
    id: "hmo_draft",
    statKey: "hmo_draft_claims",
    labelKey: "hmoDraft",
    href: "/billing/hmo?status=draft",
    tone: "amber",
    priority: 7,
    permission: PERMISSIONS.HMO_READ,
    workflowKey: "auto_hmo_claim_on_invoice",
    settingsKey: attentionShowKey("hmo_draft"),
  },
  {
    id: "queue_waiting",
    statKey: "queue_waiting",
    labelKey: "queueWaiting",
    href: "/queue",
    tone: "sky",
    priority: 8,
    permission: PERMISSIONS.QUEUE_MANAGE,
    workflowKey: "auto_checkin_updates_appointment",
    settingsKey: attentionShowKey("queue_waiting"),
    escalateAt: 8,
    escalateTo: "amber",
  },
  {
    id: "waitlist_waiting",
    statKey: "waitlist_waiting",
    labelKey: "waitlistWaiting",
    href: "/waitlist",
    tone: "sky",
    priority: 9,
    permission: PERMISSIONS.APPOINTMENTS_READ,
    workflowKey: "auto_waitlist_on_slot_open",
    settingsKey: attentionShowKey("waitlist_waiting"),
  },
  {
    id: "philhealth_pending",
    statKey: "philhealth_pending",
    labelKey: "philhealthPending",
    href: "/billing/philhealth?status=pending",
    tone: "sky",
    priority: 10,
    permission: PERMISSIONS.BILLING_READ,
    settingsKey: attentionShowKey("philhealth_pending"),
  },
]

const ATTENTION_RULE_COPY: Record<string, { label: string; description: string }> = {
  overdue_invoices: {
    label: "Overdue invoices",
    description: "Past-due balances on the billing board",
  },
  low_stock: {
    label: "Low stock alerts",
    description: "Inventory SKUs at or below reorder threshold",
  },
  pending_consents: {
    label: "Pending consents",
    description: "Unsigned required consent forms",
  },
  pending_intake_drafts: {
    label: "Pending intake drafts",
    description: "Kiosk or portal registrations awaiting review",
  },
  appointments_awaiting_checkin: {
    label: "Awaiting check-in",
    description: "Today's scheduled appointments not yet checked in",
  },
  missing_notes: {
    label: "Missing clinical notes",
    description: "Completed appointments without a linked note (7 days)",
  },
  open_invoices: {
    label: "Open invoices",
    description: "Issued invoices with outstanding balance",
  },
  hmo_draft: {
    label: "HMO draft claims",
    description: "Claims not yet submitted to the payer",
  },
  queue_waiting: {
    label: "Queue waiting",
    description: "Patients checked in and waiting to be called",
  },
  waitlist_waiting: {
    label: "Waitlist pending",
    description: "Entries awaiting contact or an open slot",
  },
  philhealth_pending: {
    label: "PhilHealth pending",
    description: "Claims awaiting submission or payer response",
  },
}

/** Branch settings keys + copy for workflow settings UI */
export const ATTENTION_RULE_UI = ATTENTION_RULES.map((rule) => {
  const copy = ATTENTION_RULE_COPY[rule.id]
  return {
    key: rule.settingsKey ?? attentionShowKey(rule.id),
    id: rule.id,
    label: copy?.label ?? rule.id.replace(/_/g, " "),
    description: copy?.description ?? "Dashboard Needs attention item",
    workflowKey: rule.workflowKey,
  }
})

function resolveTone(rule: AttentionRuleDef, count: number): AttentionTone {
  if (
    rule.escalateAt != null &&
    rule.escalateTo &&
    count >= rule.escalateAt
  ) {
    return rule.escalateTo
  }
  return rule.tone
}

function isWorkflowEnabled(
  settings: Record<string, boolean> | null,
  key: string | undefined
): boolean | null {
  if (!key || settings == null) return null
  return settings[key] !== false
}

/** Evaluate declarative rules into prioritized attention items */
export function evaluateAttentionRules(ctx: AttentionRuleContext): AttentionItem[] {
  const { stats, labels, permissions, workflowSettings } = ctx
  const items: Array<AttentionItem & { sortPriority: number }> = []

  for (const rule of ATTENTION_RULES) {
    if (rule.permission && !permissions.has(rule.permission)) continue

    const showKey = rule.settingsKey ?? attentionShowKey(rule.id)
    if (workflowSettings && workflowSettings[showKey] === false) continue

    const count = Number(stats[rule.statKey] ?? 0)
    if (count <= 0) continue

    const tone = resolveTone(rule, count)
    const automationEnabled = isWorkflowEnabled(workflowSettings, rule.workflowKey)

    items.push({
      id: rule.id,
      label: labels[rule.labelKey],
      count,
      href: rule.href,
      tone,
      automationOff: automationEnabled === false,
      workflowKey: rule.workflowKey,
      sortPriority: rule.priority * 10 + TONE_PRIORITY[tone],
    })
  }

  return items
    .sort((a, b) => a.sortPriority - b.sortPriority || b.count - a.count)
    .map(({ sortPriority: _sortPriority, ...item }) => item)
}
