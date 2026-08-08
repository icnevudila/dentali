import { createClient } from "@/lib/supabase/client"
import { formatCentavosAsPhp, pesoMajorToCentavos } from "@/lib/money/php-money"
import {
  classifyAgingBucket,
  type CollectionsAgingBucket,
} from "@/lib/billing/collections-aging"

export type { CollectionsAgingBucket }
export { classifyAgingBucket }

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
}

export type CollectionsBucketTotal = {
  bucket: CollectionsAgingBucket
  balance: number
  count: number
}

export type CollectionsArWorklist = {
  as_of_date: string
  has_open_ar: boolean
  bucket_totals: CollectionsBucketTotal[]
  rows: CollectionsArRow[]
}

type RpcPayload = {
  as_of_date?: unknown
  has_open_ar?: unknown
  bucket_totals?: unknown
  rows?: unknown
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
    bucket_totals: [],
    rows: [],
  }
}

/**
 * AR chase worklist for a branch (issued invoices with open balance).
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
  const bucketsRaw = Array.isArray(payload.bucket_totals) ? payload.bucket_totals : []
  const rows = rowsRaw.map(mapRow).filter((row): row is CollectionsArRow => row !== null)
  const bucket_totals = bucketsRaw
    .map(mapBucketTotal)
    .filter((row): row is CollectionsBucketTotal => row !== null)
    .toSorted((a, b) => BUCKETS.indexOf(a.bucket) - BUCKETS.indexOf(b.bucket))

  return {
    data: {
      as_of_date: asString(payload.as_of_date) ?? "",
      has_open_ar: Boolean(payload.has_open_ar),
      bucket_totals,
      rows,
    },
    error: null,
  }
}

export function collectionsPatientDisplayName(row: CollectionsArRow): string {
  return `${row.first_name} ${row.last_name}`.trim()
}

export function collectionsInvoiceLabel(row: CollectionsArRow): string {
  return row.invoice_number?.trim() || row.invoice_id.slice(0, 8)
}

export function filterCollectionsRows(
  rows: CollectionsArRow[],
  focus: "all" | "overdue"
): CollectionsArRow[] {
  if (focus === "overdue") return rows.filter((row) => row.is_overdue)
  return rows
}

export function sumCollectionsBalance(rows: CollectionsArRow[]): number {
  return rows.reduce((sum, row) => sum + row.balance, 0)
}

export function formatCollectionsPhp(pesoMajor: number, locale = "en-PH"): string {
  return formatCentavosAsPhp(pesoMajorToCentavos(pesoMajor), locale)
}
