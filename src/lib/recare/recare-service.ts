import { createClient } from "@/lib/supabase/client"

/** Default matches hygiene recall SMS cron / enqueue_hygiene_recalls. */
export const DEFAULT_RECARE_INTERVAL_MONTHS = 6

export type RecareDuePatient = {
  patient_id: string
  first_name: string
  last_name: string
  last_visit_date: string
  due_date: string
  days_overdue: number
}

export type RecareDueList = {
  interval_months: number
  as_of_date: string
  cutoff_date: string
  has_visit_history: boolean
  rows: RecareDuePatient[]
}

type RpcPayload = {
  interval_months?: unknown
  as_of_date?: unknown
  cutoff_date?: unknown
  has_visit_history?: unknown
  rows?: unknown
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function mapRow(raw: unknown): RecareDuePatient | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const patientId = asString(row.patient_id)
  const firstName = asString(row.first_name)
  const lastName = asString(row.last_name)
  const lastVisitDate = asString(row.last_visit_date)
  const dueDate = asString(row.due_date)
  const daysOverdue = asNumber(row.days_overdue)
  if (!patientId || !firstName || !lastName || !lastVisitDate || !dueDate || daysOverdue === null) {
    return null
  }
  return {
    patient_id: patientId,
    first_name: firstName,
    last_name: lastName,
    last_visit_date: lastVisitDate,
    due_date: dueDate,
    days_overdue: Math.max(0, Math.trunc(daysOverdue)),
  }
}

function emptyList(intervalMonths: number): RecareDueList {
  return {
    interval_months: intervalMonths,
    as_of_date: "",
    cutoff_date: "",
    has_visit_history: false,
    rows: [],
  }
}

/**
 * Due-for-recall worklist for a branch.
 * Backend enforces appointments.read; client must still gate UI with PermissionGate.
 * Does not log patient identifiers.
 */
export async function fetchRecareDueList(
  branchId: string,
  options?: { months?: number; limit?: number }
): Promise<{ data: RecareDueList; error: string | null }> {
  const months = Math.max(options?.months ?? DEFAULT_RECARE_INTERVAL_MONTHS, 1)
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100)

  if (!branchId) {
    return { data: emptyList(months), error: "Branch is required" }
  }

  const supabase = createClient()
  const { data, error } = await supabase.rpc("list_recare_due_patients", {
    p_branch_id: branchId,
    p_months: months,
    p_limit: limit,
  })

  if (error) {
    return { data: emptyList(months), error: error.message }
  }

  const payload = (data ?? {}) as RpcPayload
  const rowsRaw = Array.isArray(payload.rows) ? payload.rows : []
  const rows = rowsRaw.map(mapRow).filter((row): row is RecareDuePatient => row !== null)

  return {
    data: {
      interval_months: asNumber(payload.interval_months) ?? months,
      as_of_date: asString(payload.as_of_date) ?? "",
      cutoff_date: asString(payload.cutoff_date) ?? "",
      has_visit_history: Boolean(payload.has_visit_history),
      rows,
    },
    error: null,
  }
}

export function recarePatientDisplayName(row: RecareDuePatient): string {
  return `${row.first_name} ${row.last_name}`.trim()
}
