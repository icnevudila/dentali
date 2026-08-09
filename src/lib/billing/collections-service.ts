import { createClient } from "@/lib/supabase/client"
import { formatCentavosAsPhp, pesoMajorToCentavos } from "@/lib/money/php-money"
import {
  classifyAgingBucket,
  type CollectionsAgingBucket,
} from "@/lib/billing/collections-aging"

export type { CollectionsAgingBucket }
export { classifyAgingBucket }

export type CollectionsReminderChannel = "whatsapp" | "sms" | "email"

export type CollectionsArRow = {
  invoice_id: string
  invoice_number: string | null
  patient_id: string
  first_name: string
  last_name: string
  status: string
  total_amount: number
  paid_amount: number
  balance: number
  due_date: string | null
  issued_date: string
  days_outstanding: number
  aging_bucket: CollectionsAgingBucket
  is_overdue: boolean
  /** Last payment reminder from notification_logs (patient-scoped); no phone/body. */
  last_reminder_at: string | null
  last_reminder_channel: CollectionsReminderChannel | null
}

/** Draft invoices with balance — not issued AR; shown in a separate bucket. */
export type CollectionsDraftRow = {
  invoice_id: string
  invoice_number: string | null
  patient_id: string
  first_name: string
  last_name: string
  status: "draft"
  total_amount: number
  paid_amount: number
  balance: number
  due_date: string | null
  created_date: string
}

export type CollectionsBucketTotal = {
  bucket: CollectionsAgingBucket
  balance: number
  count: number
}

export type CollectionsArWorklist = {
  as_of_date: string
  has_open_ar: boolean
  has_draft_balance: boolean
  bucket_totals: CollectionsBucketTotal[]
  rows: CollectionsArRow[]
  draft_rows: CollectionsDraftRow[]
}

type RpcPayload = {
  as_of_date?: unknown
  has_open_ar?: unknown
  has_draft_balance?: unknown
  bucket_totals?: unknown
  rows?: unknown
  draft_rows?: unknown
}

const BUCKETS: CollectionsAgingBucket[] = ["0_30", "31_60", "60_plus"]

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function asBucket(value: unknown): CollectionsAgingBucket | null {
  return value === "0_30" || value === "31_60" || value === "60_plus" ? value : null
}

function asReminderChannel(value: unknown): CollectionsReminderChannel | null {
  return value === "whatsapp" || value === "sms" || value === "email" ? value : null
}

function mapRow(raw: unknown): CollectionsArRow | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const invoiceId = asString(row.invoice_id)
  const patientId = asString(row.patient_id)
  const firstName = asString(row.first_name)
  const lastName = asString(row.last_name)
  const status = asString(row.status)
  const totalAmount = asNumber(row.total_amount)
  const paidAmount = asNumber(row.paid_amount)
  const balance = asNumber(row.balance)
  const issuedDate = asString(row.issued_date)
  const daysOutstanding = asNumber(row.days_outstanding)
  const agingBucket = asBucket(row.aging_bucket)
  if (
    !invoiceId ||
    !patientId ||
    !firstName ||
    !lastName ||
    !status ||
    totalAmount === null ||
    paidAmount === null ||
    balance === null ||
    !issuedDate ||
    daysOutstanding === null ||
    !agingBucket
  ) {
    return null
  }
  const dueDate = typeof row.due_date === "string" ? row.due_date : null
  const lastReminderAt =
    typeof row.last_reminder_at === "string" && row.last_reminder_at.length > 0
      ? row.last_reminder_at
      : null
  return {
    invoice_id: invoiceId,
    invoice_number: typeof row.invoice_number === "string" ? row.invoice_number : null,
    patient_id: patientId,
    first_name: firstName,
    last_name: lastName,
    status,
    total_amount: totalAmount,
    paid_amount: paidAmount,
    balance,
    due_date: dueDate,
    issued_date: issuedDate,
    days_outstanding: Math.max(0, Math.trunc(daysOutstanding)),
    aging_bucket: agingBucket,
    is_overdue: Boolean(row.is_overdue),
    last_reminder_at: lastReminderAt,
    last_reminder_channel: asReminderChannel(row.last_reminder_channel),
  }
}

function mapDraftRow(raw: unknown): CollectionsDraftRow | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const invoiceId = asString(row.invoice_id)
  const patientId = asString(row.patient_id)
  const firstName = asString(row.first_name)
  const lastName = asString(row.last_name)
  const totalAmount = asNumber(row.total_amount)
  const paidAmount = asNumber(row.paid_amount)
  const balance = asNumber(row.balance)
  const createdDate = asString(row.created_date)
  if (
    !invoiceId ||
    !patientId ||
    !firstName ||
    !lastName ||
    totalAmount === null ||
    paidAmount === null ||
    balance === null ||
    !createdDate ||
    balance <= 0
  ) {
    return null
  }
  const dueDate = typeof row.due_date === "string" ? row.due_date : null
  return {
    invoice_id: invoiceId,
    invoice_number: typeof row.invoice_number === "string" ? row.invoice_number : null,
    patient_id: patientId,
    first_name: firstName,
    last_name: lastName,
    status: "draft",
    total_amount: totalAmount,
    paid_amount: paidAmount,
    balance,
    due_date: dueDate,
    created_date: createdDate,
  }
}

function mapBucketTotal(raw: unknown): CollectionsBucketTotal | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const bucket = asBucket(row.bucket)
  const balance = asNumber(row.balance)
  const count = asNumber(row.count)
  if (!bucket || balance === null || count === null) return null
  return {
    bucket,
    balance,
    count: Math.max(0, Math.trunc(count)),
  }
}

function emptyWorklist(): CollectionsArWorklist {
  return {
    as_of_date: "",
    has_open_ar: false,
    has_draft_balance: false,
    bucket_totals: [],
    rows: [],
    draft_rows: [],
  }
}

/**
 * AR chase worklist for a branch (issued invoices with open balance).
 * Also returns draft invoices with balance in a separate draft_rows bucket —
 * drafts are not issued AR and must not inflate aging/overdue totals.
 * Backend enforces billing.read; client must still gate UI with PermissionGate.
 * Does not log patient or invoice identifiers.
 */
export async function fetchCollectionsArWorklist(
  branchId: string,
  options?: { limit?: number }
): Promise<{ data: CollectionsArWorklist; error: string | null }> {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100)

  if (!branchId) {
    return { data: emptyWorklist(), error: "Branch is required" }
  }

  const supabase = createClient()
  const { data, error } = await supabase.rpc("list_collections_ar_worklist", {
    p_branch_id: branchId,
    p_limit: limit,
  })

  if (error) {
    return { data: emptyWorklist(), error: error.message }
  }

  const payload = (data ?? {}) as RpcPayload
  const rowsRaw = Array.isArray(payload.rows) ? payload.rows : []
  const draftsRaw = Array.isArray(payload.draft_rows) ? payload.draft_rows : []
  const bucketsRaw = Array.isArray(payload.bucket_totals) ? payload.bucket_totals : []
  const rows = rowsRaw.map(mapRow).filter((row): row is CollectionsArRow => row !== null)
  const draft_rows = draftsRaw
    .map(mapDraftRow)
    .filter((row): row is CollectionsDraftRow => row !== null)
  const bucket_totals = bucketsRaw
    .map(mapBucketTotal)
    .filter((row): row is CollectionsBucketTotal => row !== null)
    .toSorted((a, b) => BUCKETS.indexOf(a.bucket) - BUCKETS.indexOf(b.bucket))

  return {
    data: {
      as_of_date: asString(payload.as_of_date) ?? "",
      has_open_ar: Boolean(payload.has_open_ar),
      has_draft_balance: Boolean(payload.has_draft_balance) || draft_rows.length > 0,
      bucket_totals,
      rows,
      draft_rows,
    },
    error: null,
  }
}

export function collectionsPatientDisplayName(
  row: Pick<CollectionsArRow, "first_name" | "last_name">
): string {
  return `${row.first_name} ${row.last_name}`.trim()
}

export function collectionsInvoiceLabel(
  row: Pick<CollectionsArRow, "invoice_number" | "invoice_id">
): string {
  return row.invoice_number?.trim() || row.invoice_id.slice(0, 8)
}

export function filterCollectionsRows(
  rows: CollectionsArRow[],
  focus: "all" | "overdue"
): CollectionsArRow[] {
  if (focus === "overdue") return rows.filter((row) => row.is_overdue)
  return rows
}

/** Overdue focus counts issued AR only — drafts are never overdue. */
export function countOverdueCollectionsRows(rows: CollectionsArRow[]): number {
  return rows.filter((row) => row.is_overdue).length
}

export function sumCollectionsBalance(
  rows: Array<Pick<CollectionsArRow, "balance">>
): number {
  return rows.reduce((sum, row) => sum + row.balance, 0)
}

/** Deep-link to invoice detail where the existing WhatsApp reminder UI lives. */
export function collectionsReminderHref(invoiceId: string): string {
  return `/billing/${invoiceId}?focus=reminder`
}

export function formatCollectionsPhp(pesoMajor: number, locale = "en-PH"): string {
  return formatCentavosAsPhp(pesoMajorToCentavos(pesoMajor), locale)
}
