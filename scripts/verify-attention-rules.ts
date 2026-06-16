/**
 * Smoke tests for the declarative attention rule engine (VA-F7-03).
 * Run: npx tsx scripts/verify-attention-rules.ts
 */
import assert from "node:assert/strict"
import { PERMISSIONS } from "@/lib/auth/permissions"
import type { DashboardStats } from "@/lib/dashboard/dashboard-service"
import {
  ATTENTION_RULES,
  ATTENTION_RULE_UI,
  attentionShowKey,
  evaluateAttentionRules,
} from "@/lib/dashboard/attention-rules"
import type { AttentionLabels } from "@/lib/dashboard/attention-items"

const labels: AttentionLabels = {
  pendingConsents: "Pending consents",
  pendingIntakeDrafts: "Pending intake drafts",
  appointmentsAwaitingCheckin: "Awaiting check-in",
  queueWaiting: "Queue waiting",
  waitlistWaiting: "Waitlist",
  openInvoices: "Open invoices",
  lowStock: "Low stock",
  missingNotes: "Missing notes",
  overdueInvoices: "Overdue invoices",
  hmoDraft: "HMO draft",
  philhealthPending: "PhilHealth pending",
  openEncountersStale: "Open visits from prior days",
}

const baseStats: DashboardStats = {
  active_patients: 0,
  today_appointments: 0,
  pending_consents: 0,
  queue_waiting: 0,
  waitlist_waiting: 0,
  open_invoices: 0,
  overdue_invoices: 0,
  today_collected: 0,
  low_stock_items: 0,
  missing_clinical_notes: 0,
  hmo_draft_claims: 0,
  philhealth_pending: 0,
  pending_intake_drafts: 0,
  appointments_awaiting_checkin: 0,
  open_encounters_stale: 0,
}

const allPermissions = new Set<string>([
  PERMISSIONS.PATIENTS_READ,
  PERMISSIONS.APPOINTMENTS_READ,
  PERMISSIONS.QUEUE_MANAGE,
  PERMISSIONS.BILLING_READ,
  PERMISSIONS.HMO_READ,
])

function run() {
  assert.equal(ATTENTION_RULE_UI.length, ATTENTION_RULES.length, "UI metadata covers all rules")

  const empty = evaluateAttentionRules({
    stats: baseStats,
    labels,
    permissions: allPermissions,
    workflowSettings: null,
  })
  assert.equal(empty.length, 0, "zero counts → no items")

  const withOverdue = evaluateAttentionRules({
    stats: { ...baseStats, overdue_invoices: 2, open_invoices: 5 },
    labels,
    permissions: allPermissions,
    workflowSettings: { auto_payment_reminder: false },
  })
  assert.ok(withOverdue.some((i) => i.id === "overdue_invoices"), "overdue rule fires")
  const overdueItem = withOverdue.find((i) => i.id === "overdue_invoices")
  assert.equal(overdueItem?.automationOff, true, "automation off when workflow disabled")
  assert.equal(overdueItem?.href, "/billing?focus=overdue")

  const hidden = evaluateAttentionRules({
    stats: { ...baseStats, pending_consents: 3 },
    labels,
    permissions: allPermissions,
    workflowSettings: { [attentionShowKey("pending_consents")]: false },
  })
  assert.ok(!hidden.some((i) => i.id === "pending_consents"), "attention_show=false hides rule")

  const noBilling = evaluateAttentionRules({
    stats: { ...baseStats, overdue_invoices: 1 },
    labels,
    permissions: new Set([PERMISSIONS.PATIENTS_READ]),
    workflowSettings: null,
  })
  assert.ok(!noBilling.some((i) => i.id === "overdue_invoices"), "permission gate")

  const escalated = evaluateAttentionRules({
    stats: { ...baseStats, queue_waiting: 10 },
    labels,
    permissions: allPermissions,
    workflowSettings: null,
  })
  const queue = escalated.find((i) => i.id === "queue_waiting")
  assert.equal(queue?.tone, "amber", "queue escalates at 8+")

  console.log("verify-attention-rules: OK")
}

run()
