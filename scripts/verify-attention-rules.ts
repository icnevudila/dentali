/**
 * Smoke tests for the declarative attention rule engine (VA-F7-03).
 * Run: npx tsx scripts/verify-attention-rules.ts
 * Or:  npm run verify:attention
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
import { getMessages, type MessageTree } from "@/lib/i18n/messages"
import type { AppLocale } from "@/lib/i18n/config"

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
  recareDue: "Recare due",
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
  hmo_pending_claims: 0,
  recare_due: 0,
}

const allPermissions = new Set<string>([
  PERMISSIONS.PATIENTS_READ,
  PERMISSIONS.APPOINTMENTS_READ,
  PERMISSIONS.QUEUE_MANAGE,
  PERMISSIONS.BILLING_READ,
  PERMISSIONS.HMO_READ,
])

/** Contract: attention deep-links must stay aligned with destination pages */
const EXPECTED_HREFS: Record<string, string> = {
  overdue_invoices: "/billing/collections?focus=overdue",
  low_stock: "/inventory?alerts=1",
  pending_consents: "/patients?attention=consents",
  pending_intake_drafts: "/patients?attention=intake",
  open_encounters_stale: "/reports?focus=clinical#clinical",
  appointments_awaiting_checkin: "/queue?focus=checkin",
  missing_notes: "/appointments?focus=missing-notes",
  open_invoices: "/billing?focus=open",
  hmo_draft: "/billing/hmo?status=draft",
  queue_waiting: "/queue?focus=waiting",
  waitlist_waiting: "/waitlist",
  philhealth_pending: "/billing/philhealth?status=pending",
  recare_due: "/recare",
}

const ATTENTION_PANEL_I18N_KEYS = [
  "dashboard.attentionTitle",
  "dashboard.attentionClear",
  "dashboard.attentionManualHint",
  "dashboard.pendingConsents",
  "dashboard.pendingIntakeDrafts",
  "dashboard.awaitingCheckin",
  "dashboard.queueWaiting",
  "dashboard.waitlistWaiting",
  "dashboard.openInvoices",
  "dashboard.lowStockItems",
  "dashboard.missingNotes",
  "dashboard.overdueInvoices",
  "dashboard.hmoDraft",
  "dashboard.philhealthPending",
  "dashboard.openEncountersStale",
  "dashboard.openQueue",
  "dashboard.recareDue",
] as const

function getNestedValue(tree: MessageTree, key: string): string | undefined {
  const parts = key.split(".")
  let current: string | MessageTree | undefined = tree
  for (const part of parts) {
    if (typeof current !== "object" || current === null) return undefined
    current = current[part]
  }
  return typeof current === "string" ? current : undefined
}

function assertCatalogKeys(locale: AppLocale, keys: readonly string[]) {
  const catalog = getMessages(locale)
  for (const key of keys) {
    const value = getNestedValue(catalog, key)
    assert.ok(value && value.trim().length > 0, `${locale} missing/empty: ${key}`)
  }
}

function run() {
  assert.equal(ATTENTION_RULE_UI.length, ATTENTION_RULES.length, "UI metadata covers all rules")
  assert.equal(
    ATTENTION_RULES.length,
    Object.keys(EXPECTED_HREFS).length,
    "href contract covers every rule"
  )

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
  assert.equal(overdueItem?.href, "/billing/collections")

  const withRecare = evaluateAttentionRules({
    stats: { ...baseStats, recare_due: 4 },
    labels,
    permissions: allPermissions,
    workflowSettings: { auto_hygiene_recall: false },
  })
  const recareItem = withRecare.find((i) => i.id === "recare_due")
  assert.ok(recareItem, "recare_due rule fires")
  assert.equal(recareItem?.href, "/recare")
  assert.equal(recareItem?.automationOff, true, "recare automation off hint")

  const noAppts = evaluateAttentionRules({
    stats: { ...baseStats, recare_due: 2 },
    labels,
    permissions: new Set([PERMISSIONS.BILLING_READ]),
    workflowSettings: null,
  })
  assert.ok(!noAppts.some((i) => i.id === "recare_due"), "recare permission gate")

  const openInvoicesRule = ATTENTION_RULES.find((r) => r.id === "open_invoices")
  assert.ok(openInvoicesRule, "open_invoices rule exists")
  assert.equal(
    openInvoicesRule?.workflowKey,
    undefined,
    "open_invoices must not fake an automation-off hint"
  )

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

  for (const rule of ATTENTION_RULES) {
    const expected = EXPECTED_HREFS[rule.id]
    assert.ok(expected, `expected href for ${rule.id}`)
    assert.equal(rule.href, expected, `href contract for ${rule.id}`)
    assert.ok(rule.href.startsWith("/"), `absolute path for ${rule.id}`)
  }

  for (const item of ATTENTION_RULE_UI) {
    assert.ok(item.labelKey.startsWith("settings.attentionRule."), `labelKey for ${item.id}`)
    assert.ok(item.descriptionKey.endsWith(".description"), `descriptionKey for ${item.id}`)
    assert.ok(item.label.length > 0, `EN fallback label for ${item.id}`)
  }

  const ruleI18nKeys = ATTENTION_RULE_UI.flatMap((item) => [item.labelKey, item.descriptionKey])
  for (const locale of ["en", "tr", "fil"] as const) {
    assertCatalogKeys(locale, ATTENTION_PANEL_I18N_KEYS)
    assertCatalogKeys(locale, ruleI18nKeys)
  }

  const en = getMessages("en")
  const tr = getMessages("tr")
  for (const key of [...ATTENTION_PANEL_I18N_KEYS, ...ruleI18nKeys]) {
    const enVal = getNestedValue(en, key)
    const trVal = getNestedValue(tr, key)
    assert.ok(enVal && trVal, `en/tr present for ${key}`)
    // Brand/product tokens may match; attention staff copy must differ.
    if (enVal === trVal && !/^(HMO|PhilHealth|Queue|SKU)$/i.test(enVal.trim())) {
      assert.notEqual(trVal, enVal, `TR must differ from EN for ${key}`)
    }
  }

  console.log("verify-attention-rules: OK")
}

run()
