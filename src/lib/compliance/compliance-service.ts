import { createClient } from "@/lib/supabase/client"

export type CycleMethod = "gravity" | "pre_vacuum" | "statim" | "other"
export type IndicatorResult = "pass" | "fail" | "pending" | "not_used"
export type ComplianceResultStatus = "pass" | "fail" | "pending" | "aborted"

export interface ComplianceCycle {
  id: string
  branch_id: string
  equipment_name: string
  load_description: string | null
  cycle_method: CycleMethod
  started_at: string
  completed_at: string | null
  duration_minutes: number | null
  temperature_c: number | null
  biological_indicator: IndicatorResult
  chemical_indicator: Exclude<IndicatorResult, "not_used">
  result_status: ComplianceResultStatus
  operator_name: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  logged_by_name: string | null
}

export interface ComplianceSummary {
  total_30d: number
  passed_30d: number
  failed_30d: number
  pending_30d: number
  last_cycle_at: string | null
  last_pass_at: string | null
}

export async function fetchComplianceCycles(
  branchId: string,
  since?: string | null
): Promise<{ data: ComplianceCycle[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_compliance_cycles", {
    p_branch_id: branchId,
    p_limit: 100,
    p_since: since ?? null,
  })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as ComplianceCycle[], error: null }
}

export async function fetchComplianceSummary(
  branchId: string
): Promise<{ data: ComplianceSummary | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_compliance_summary", {
    p_branch_id: branchId,
  })

  if (error) return { data: null, error: error.message }

  const raw = (data ?? {}) as Record<string, unknown>
  return {
    data: {
      total_30d: Number(raw.total_30d ?? 0),
      passed_30d: Number(raw.passed_30d ?? 0),
      failed_30d: Number(raw.failed_30d ?? 0),
      pending_30d: Number(raw.pending_30d ?? 0),
      last_cycle_at: typeof raw.last_cycle_at === "string" ? raw.last_cycle_at : null,
      last_pass_at: typeof raw.last_pass_at === "string" ? raw.last_pass_at : null,
    },
    error: null,
  }
}

export async function logComplianceCycle(params: {
  branchId: string
  equipmentName: string
  loadDescription?: string
  cycleMethod: CycleMethod
  startedAt: string
  completedAt?: string
  durationMinutes?: number
  temperatureC?: number
  biologicalIndicator: IndicatorResult
  chemicalIndicator: Exclude<IndicatorResult, "not_used">
  resultStatus: ComplianceResultStatus
  operatorName?: string
  notes?: string
}): Promise<{ id: string | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("log_compliance_cycle", {
    p_branch_id: params.branchId,
    p_equipment_name: params.equipmentName,
    p_load_description: params.loadDescription ?? null,
    p_cycle_method: params.cycleMethod,
    p_started_at: params.startedAt,
    p_completed_at: params.completedAt ?? null,
    p_duration_minutes: params.durationMinutes ?? null,
    p_temperature_c: params.temperatureC ?? null,
    p_biological_indicator: params.biologicalIndicator,
    p_chemical_indicator: params.chemicalIndicator,
    p_result_status: params.resultStatus,
    p_operator_name: params.operatorName ?? null,
    p_notes: params.notes ?? null,
  })

  if (error) return { id: null, error: error.message }
  return { id: data as string, error: null }
}

export function downloadComplianceCsv(cycles: ComplianceCycle[], branchName: string) {
  const header = [
    "started_at",
    "equipment",
    "load",
    "method",
    "duration_min",
    "temp_c",
    "bio_indicator",
    "chem_indicator",
    "result",
    "operator",
    "logged_by",
    "notes",
  ]
  const rows = cycles.map((c) =>
    [
      c.started_at,
      c.equipment_name,
      c.load_description ?? "",
      c.cycle_method,
      c.duration_minutes ?? "",
      c.temperature_c ?? "",
      c.biological_indicator,
      c.chemical_indicator,
      c.result_status,
      c.operator_name ?? "",
      c.logged_by_name ?? "",
      c.notes ?? "",
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(",")
  )
  const csv = [header.join(","), ...rows].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `sterilization-log-${branchName.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export const CYCLE_METHOD_OPTIONS: { value: CycleMethod; labelKey: string; fallback: string }[] = [
  { value: "gravity", labelKey: "compliance.methodGravity", fallback: "Gravity displacement" },
  { value: "pre_vacuum", labelKey: "compliance.methodPreVac", fallback: "Pre-vacuum (Class B)" },
  { value: "statim", labelKey: "compliance.methodStatim", fallback: "Statim / cassette" },
  { value: "other", labelKey: "compliance.methodOther", fallback: "Other" },
]

export const INDICATOR_OPTIONS: { value: IndicatorResult; labelKey: string; fallback: string }[] = [
  { value: "pass", labelKey: "compliance.indicatorPass", fallback: "Pass" },
  { value: "fail", labelKey: "compliance.indicatorFail", fallback: "Fail" },
  { value: "pending", labelKey: "compliance.indicatorPending", fallback: "Pending" },
  { value: "not_used", labelKey: "compliance.indicatorNotUsed", fallback: "Not used" },
]

export const CHEMICAL_INDICATOR_OPTIONS = INDICATOR_OPTIONS.filter(
  (o): o is { value: Exclude<IndicatorResult, "not_used">; labelKey: string; fallback: string } =>
    o.value !== "not_used"
)
