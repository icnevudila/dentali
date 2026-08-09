import { createClient } from "@/lib/supabase/client"
import {
  DEFAULT_RECARE_INTERVAL_MONTHS,
  resolveRecareIntervalMonthsFromSettings,
} from "@/lib/recare/recare-interval"

export {
  DEFAULT_RECARE_INTERVAL_MONTHS,
  HYGIENE_RECALL_MONTHS_KEY,
  MAX_RECARE_INTERVAL_MONTHS,
  MIN_RECARE_INTERVAL_MONTHS,
  parseRecareIntervalMonths,
  resolveRecareIntervalMonthsFromSettings,
} from "@/lib/recare/recare-interval"

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
 * Read hygiene_recall_months from branch workflow settings when present.
 * Does not log patient identifiers. Falls back to clinic default (6).
 */
export async function fetchConfiguredRecareIntervalMonths(
  branchId: string
): Promise<{ months: number; error: string | null }> {
  if (!branchId) {
    return { months: DEFAULT_RECARE_INTERVAL_MONTHS, error: "Branch is required" }
  }

  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_branch_workflow_settings", {
    p_branch_id: branchId,
  })

  if (error) {
    return { months: DEFAULT_RECARE_INTERVAL_MONTHS, error: error.message }
  }

  return {
    months: resolveRecareIntervalMonthsFromSettings(
      data && typeof data === "object" ? (data as Record<string, unknown>) : null
    ),
    error: null,
  }
}

/**
 * Due-for-recall worklist for a branch.
 * Backend enforces appointments.read; client must still gate UI with PermissionGate.
 * Interval months come from workflow settings (hygiene_recall_months) when set, else 6.
 * Does not log patient identifiers.
 */
export async function fetchRecareDueList(
  branchId: string,
  options?: { months?: number; limit?: number }
): Promise<{ data: RecareDueList; error: string | null }> {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100)

  if (!branchId) {
    return { data: emptyList(DEFAULT_RECARE_INTERVAL_MONTHS), error: "Branch is required" }
  }

  let months = options?.months
  if (months == null) {
    const configured = await fetchConfiguredRecareIntervalMonths(branchId)
    months = configured.months
    // Soft-fail on settings read: still load due list with default months.
  }
  months = Math.max(months, 1)

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

/** Waitlist deep-link with patient prefill (matches appointments query params). */
export function recareWaitlistHref(patientId: string, displayName: string): string {
  const params = new URLSearchParams({
    patient: patientId,
    patientName: displayName,
  })
  return `/waitlist?${params.toString()}`
}

export const RECARE_SNOOZE_DAY_OPTIONS = [7, 14, 30] as const

export type RecareSnoozeDays = (typeof RECARE_SNOOZE_DAY_OPTIONS)[number]

export type RecareSnoozeResult = {
  patient_id: string
  branch_id: string
  days: number
  snoozed_until: string
  as_of_date: string
}

/**
 * Hide a due patient from the recare worklist for N days (1–90).
 * Backend enforces appointments.write + audit (no PHI names in logs).
 */
export async function snoozeRecarePatient(
  branchId: string,
  patientId: string,
  days: number
): Promise<{ data: RecareSnoozeResult | null; error: string | null }> {
  if (!branchId || !patientId) {
    return { data: null, error: "Branch and patient are required" }
  }
  const snoozeDays = Math.trunc(days)
  if (snoozeDays < 1 || snoozeDays > 90) {
    return { data: null, error: "Snooze days must be between 1 and 90" }
  }

  const supabase = createClient()
  const { data, error } = await supabase.rpc("snooze_recare_patient", {
    p_branch_id: branchId,
    p_patient_id: patientId,
    p_days: snoozeDays,
  })

  if (error) {
    return { data: null, error: error.message }
  }

  const payload = (data ?? {}) as Record<string, unknown>
  const until = asString(payload.snoozed_until)
  const asOf = asString(payload.as_of_date)
  if (!until || !asOf) {
    return { data: null, error: "Unexpected snooze response" }
  }

  return {
    data: {
      patient_id: asString(payload.patient_id) ?? patientId,
      branch_id: asString(payload.branch_id) ?? branchId,
      days: asNumber(payload.days) ?? snoozeDays,
      snoozed_until: until,
      as_of_date: asOf,
    },
    error: null,
  }
}

/**
 * Clear recare snooze so the patient can reappear on the due list.
 * Backend enforces appointments.write + audit.
 */
export async function unsnoozeRecarePatient(
  branchId: string,
  patientId: string
): Promise<{ error: string | null }> {
  if (!branchId || !patientId) {
    return { error: "Branch and patient are required" }
  }

  const supabase = createClient()
  const { error } = await supabase.rpc("unsnooze_recare_patient", {
    p_branch_id: branchId,
    p_patient_id: patientId,
  })

  if (error) {
    return { error: error.message }
  }
  return { error: null }
}
