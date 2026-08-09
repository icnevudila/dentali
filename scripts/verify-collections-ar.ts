/**
 * Smoke checks for collections AR helpers (no network / no PHI).
 * Run: npx tsx scripts/verify-collections-ar.ts
 */
import { classifyAgingBucket } from "../src/lib/billing/collections-aging"
import {
  collectionsReminderHref,
  countOverdueCollectionsRows,
  filterCollectionsRows,
  sumCollectionsBalance,
  type CollectionsArRow,
} from "../src/lib/billing/collections-service"

const agingCases: Array<{ days: number; expect: ReturnType<typeof classifyAgingBucket> }> = [
  { days: 0, expect: "0_30" },
  { days: 30, expect: "0_30" },
  { days: 31, expect: "31_60" },
  { days: 60, expect: "31_60" },
  { days: 61, expect: "60_plus" },
  { days: -5, expect: "0_30" },
]

let failed = 0
for (const c of agingCases) {
  const got = classifyAgingBucket(c.days)
  if (got !== c.expect) {
    console.error(`classifyAgingBucket(${c.days}) => ${got}, expected ${c.expect}`)
    failed += 1
  }
}

const sampleRows: CollectionsArRow[] = [
  {
    invoice_id: "a0000000-0000-4000-8000-000000000001",
    invoice_number: "INV-1",
    patient_id: "p0000000-0000-4000-8000-000000000001",
    first_name: "Sample",
    last_name: "One",
    status: "sent",
    total_amount: 1000,
    paid_amount: 0,
    balance: 1000,
    due_date: "2026-01-01",
    issued_date: "2026-01-01",
    days_outstanding: 40,
    aging_bucket: "31_60",
    is_overdue: true,
  },
  {
    invoice_id: "a0000000-0000-4000-8000-000000000002",
    invoice_number: "INV-2",
    patient_id: "p0000000-0000-4000-8000-000000000002",
    first_name: "Sample",
    last_name: "Two",
    status: "partial",
    total_amount: 500,
    paid_amount: 100,
    balance: 400,
    due_date: null,
    issued_date: "2026-08-01",
    days_outstanding: 5,
    aging_bucket: "0_30",
    is_overdue: false,
  },
]

const overdue = filterCollectionsRows(sampleRows, "overdue")
if (overdue.length !== 1 || !overdue[0]?.is_overdue) {
  console.error("filterCollectionsRows(overdue) expected 1 overdue row")
  failed += 1
}

if (countOverdueCollectionsRows(sampleRows) !== 1) {
  console.error("countOverdueCollectionsRows expected 1")
  failed += 1
}

if (sumCollectionsBalance(sampleRows) !== 1400) {
  console.error("sumCollectionsBalance expected 1400")
  failed += 1
}

const reminderHref = collectionsReminderHref(sampleRows[0]!.invoice_id)
if (reminderHref !== `/billing/${sampleRows[0]!.invoice_id}?focus=reminder`) {
  console.error(`collectionsReminderHref unexpected: ${reminderHref}`)
  failed += 1
}

if (failed > 0) {
  console.error(`FAILED: ${failed} case(s)`)
  process.exit(1)
}

console.log("verify-collections-ar: ok")
