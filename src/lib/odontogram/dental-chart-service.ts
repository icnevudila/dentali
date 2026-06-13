import { createClient } from "@/lib/supabase/client"
import type { ToothFinding } from "@/lib/types/dental"
import { getShowcaseSnapshot } from "@/lib/showcase/intercept"

export interface OdontogramPayload {
  id: string | null
  patient_id: string
  branch_id: string
  findings: ToothFinding[]
}

function isMissingRpcError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  const msg = (error.message ?? "").toLowerCase()
  return (
    error.code === "PGRST202" ||
    msg.includes("could not find the function") ||
    msg.includes("schema cache") ||
    (msg.includes("function") && msg.includes("does not exist"))
  )
}

function mapFindingRow(row: Record<string, unknown>): ToothFinding {
  return {
    id: row.id as string | undefined,
    tooth_number: String(row.tooth_number),
    dentition_type: (row.dentition_type as ToothFinding["dentition_type"]) ?? "permanent",
    condition: (row.condition as ToothFinding["condition"]) ?? null,
    surfaces: (row.surfaces as ToothFinding["surfaces"]) ?? [],
    restoration_type: (row.restoration_type as ToothFinding["restoration_type"]) ?? null,
    surgery_type: (row.surgery_type as ToothFinding["surgery_type"]) ?? null,
    notes: (row.notes as string) ?? undefined,
    status: (row.status as ToothFinding["status"]) ?? "active",
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  }
}

async function getPatientOdontogramDirect(
  patientId: string,
  branchId: string | null
): Promise<{ data: OdontogramPayload | null; error: string | null }> {
  if (!branchId) {
    return {
      data: { id: null, patient_id: patientId, branch_id: "", findings: [] },
      error: null,
    }
  }

  const supabase = createClient()
  const { data: chart, error: chartError } = await supabase
    .from("dental_charts")
    .select("id, patient_id, branch_id")
    .eq("patient_id", patientId)
    .eq("branch_id", branchId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (chartError) return { data: null, error: chartError.message }
  if (!chart) {
    return {
      data: { id: null, patient_id: patientId, branch_id: branchId, findings: [] },
      error: null,
    }
  }

  const { data: rows, error: findingsError } = await supabase
    .from("tooth_findings")
    .select(
      "id, tooth_number, dentition_type, condition, surfaces, restoration_type, surgery_type, notes, status, created_at, updated_at"
    )
    .eq("chart_id", chart.id)
    .eq("status", "active")
    .order("tooth_number")

  if (findingsError) return { data: null, error: findingsError.message }

  return {
    data: {
      id: chart.id,
      patient_id: chart.patient_id,
      branch_id: chart.branch_id,
      findings: (rows ?? []).map((row) => mapFindingRow(row as Record<string, unknown>)),
    },
    error: null,
  }
}

export async function getPatientOdontogram(
  patientId: string,
  branchId: string | null
): Promise<{ data: OdontogramPayload | null; error: string | null }> {
  const showcase = getShowcaseSnapshot()
  if (showcase && patientId === showcase.chartPatientId) {
    return {
      data: {
        id: "showcase-chart",
        patient_id: patientId,
        branch_id: showcase.branch.id,
        findings: showcase.chartFindings,
      },
      error: null,
    }
  }

  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_patient_odontogram", {
    p_patient_id: patientId,
    p_branch_id: branchId,
  })

  if (isMissingRpcError(error)) {
    return getPatientOdontogramDirect(patientId, branchId)
  }

  if (error) return { data: null, error: error.message }

  const payload = data as {
    id?: string
    patient_id?: string
    branch_id?: string
    findings?: ToothFinding[]
  } | null

  if (!payload?.id) {
    if (branchId) {
      const direct = await getPatientOdontogramDirect(patientId, branchId)
      if (direct.data?.id) return direct
    }
    return {
      data: {
        id: null,
        patient_id: patientId,
        branch_id: branchId ?? "",
        findings: [],
      },
      error: null,
    }
  }

  return {
    data: {
      id: payload.id,
      patient_id: payload.patient_id ?? patientId,
      branch_id: payload.branch_id ?? branchId ?? "",
      findings: (payload.findings ?? []) as ToothFinding[],
    },
    error: null,
  }
}

export async function fetchOdontogramFindingsForPatients(
  patientIds: string[],
  branchId: string | null
): Promise<{ data: Record<string, ToothFinding[]>; error: string | null }> {
  const showcase = getShowcaseSnapshot()
  if (showcase) {
    const map: Record<string, ToothFinding[]> = {}
    for (const id of patientIds) {
      if (id === showcase.chartPatientId) {
        map[id] = showcase.chartFindings
      } else {
        map[id] = []
      }
    }
    return { data: map, error: null }
  }

  if (patientIds.length === 0) return { data: {}, error: null }

  const results = await Promise.all(
    patientIds.map(async (patientId) => {
      const { data, error } = await getPatientOdontogram(patientId, branchId)
      return { patientId, findings: data?.findings ?? [], error }
    })
  )

  const firstError = results.find((r) => r.error)?.error ?? null
  const map: Record<string, ToothFinding[]> = {}
  for (const row of results) {
    map[row.patientId] = row.findings
  }
  return { data: map, error: firstError }
}

export async function ensureDentalChart(
  patientId: string,
  branchId: string,
  organizationId: string,
  userId: string
): Promise<{ chartId: string; error: string | null }> {
  const supabase = createClient()

  const { data: existing } = await supabase
    .from("dental_charts")
    .select("id")
    .eq("patient_id", patientId)
    .eq("branch_id", branchId)
    .eq("status", "active")
    .maybeSingle()

  if (existing?.id) return { chartId: existing.id, error: null }

  const { data, error } = await supabase
    .from("dental_charts")
    .insert({
      organization_id: organizationId,
      branch_id: branchId,
      patient_id: patientId,
      created_by: userId,
      updated_by: userId,
    })
    .select("id")
    .single()

  if (error || !data) return { chartId: "", error: error?.message ?? "Failed to create chart" }
  return { chartId: data.id, error: null }
}

export async function upsertToothFinding(params: {
  organizationId: string
  branchId: string
  chartId: string
  patientId: string
  finding: ToothFinding
  actorUserId: string
}): Promise<{ data: ToothFinding | null; error: string | null }> {
  const supabase = createClient()
  const { finding } = params

  const { data, error } = await supabase.rpc("upsert_tooth_finding", {
    p_organization_id: params.organizationId,
    p_branch_id: params.branchId,
    p_chart_id: params.chartId,
    p_patient_id: params.patientId,
    p_tooth_number: finding.tooth_number,
    p_dentition_type: finding.dentition_type,
    p_condition: finding.condition ?? null,
    p_surfaces: finding.surfaces ?? [],
    p_restoration_type: finding.restoration_type ?? null,
    p_surgery_type: finding.surgery_type ?? null,
    p_notes: finding.notes ?? null,
    p_actor_user_id: params.actorUserId,
  })

  if (isMissingRpcError(error)) {
    return upsertToothFindingDirect(params)
  }

  if (error) return { data: null, error: error.message }
  return { data: data as ToothFinding, error: null }
}

async function upsertToothFindingDirect(params: {
  organizationId: string
  branchId: string
  chartId: string
  patientId: string
  finding: ToothFinding
  actorUserId: string
}): Promise<{ data: ToothFinding | null; error: string | null }> {
  const supabase = createClient()
  const { finding } = params

  const { data: existing } = await supabase
    .from("tooth_findings")
    .select("id")
    .eq("chart_id", params.chartId)
    .eq("tooth_number", finding.tooth_number)
    .eq("status", "active")
    .maybeSingle()

  const payload = {
    chart_id: params.chartId,
    patient_id: params.patientId,
    organization_id: params.organizationId,
    branch_id: params.branchId,
    tooth_number: finding.tooth_number,
    dentition_type: finding.dentition_type ?? "permanent",
    condition: finding.condition ?? null,
    surfaces: finding.surfaces ?? [],
    restoration_type: finding.restoration_type ?? null,
    surgery_type: finding.surgery_type ?? null,
    notes: finding.notes ?? null,
    updated_by: params.actorUserId,
  }

  if (existing?.id) {
    const { data, error } = await supabase
      .from("tooth_findings")
      .update(payload)
      .eq("id", existing.id)
      .select(
        "id, tooth_number, dentition_type, condition, surfaces, restoration_type, surgery_type, notes, status, created_at, updated_at"
      )
      .single()
    if (error) return { data: null, error: error.message }
    return { data: mapFindingRow(data as Record<string, unknown>), error: null }
  }

  const { data, error } = await supabase
    .from("tooth_findings")
    .insert({ ...payload, created_by: params.actorUserId, status: "active" })
    .select(
      "id, tooth_number, dentition_type, condition, surfaces, restoration_type, surgery_type, notes, status, created_at, updated_at"
    )
    .single()

  if (error) return { data: null, error: error.message }
  return { data: mapFindingRow(data as Record<string, unknown>), error: null }
}

export interface ChartAuditEvent {
  id: string
  action: string
  tooth_number: string | null
  before_json: Record<string, unknown> | null
  after_json: Record<string, unknown> | null
  created_at: string
  actor_user_id: string | null
  actor_name: string | null
}

export function summarizeAuditEvent(event: ChartAuditEvent): string {
  const after = event.after_json as {
    condition?: string | null
    restoration_type?: string | null
    surgery_type?: string | null
  } | null
  const before = event.before_json as { condition?: string | null } | null
  const tooth = event.tooth_number ?? "?"

  if (event.action === "INSERT") {
    const parts = [after?.condition, after?.restoration_type, after?.surgery_type].filter(Boolean)
    return `Tooth ${tooth}: ${parts.join(", ") || "new finding recorded"}`
  }

  if (before?.condition !== after?.condition) {
    return `Tooth ${tooth}: ${before?.condition ?? "clear"} → ${after?.condition ?? "clear"}`
  }

  return `Tooth ${tooth} updated`
}

const AUDIT_FIELD_LABELS: Record<string, string> = {
  condition: "Condition",
  restoration_type: "Restoration",
  surgery_type: "Surgery",
  surfaces: "Surfaces",
  notes: "Notes",
  dentition_type: "Dentition",
}

function formatAuditValue(value: unknown): string {
  if (value == null || value === "") return "—"
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—"
  return String(value)
}

export function describeAuditDiffLines(event: ChartAuditEvent): { label: string; before: string; after: string }[] {
  const keys = new Set([
    ...Object.keys(event.before_json ?? {}),
    ...Object.keys(event.after_json ?? {}),
  ])
  const lines: { label: string; before: string; after: string }[] = []

  for (const key of keys) {
    if (key === "tooth_number" || key === "id") continue
    const before = formatAuditValue(event.before_json?.[key])
    const after = formatAuditValue(event.after_json?.[key])
    if (before === after) continue
    lines.push({
      label: AUDIT_FIELD_LABELS[key] ?? key.replace(/_/g, " "),
      before,
      after,
    })
  }

  return lines
}

export async function fetchChartAuditHistory(params: {
  patientId: string
  chartId?: string | null
  limit?: number
}): Promise<{ data: ChartAuditEvent[]; error: string | null }> {
  const supabase = createClient()
  let query = supabase
    .from("dental_chart_audit_events")
    .select("id, action, tooth_number, before_json, after_json, created_at, actor_user_id")
    .eq("patient_id", params.patientId)
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 100)

  if (params.chartId) {
    query = query.eq("chart_id", params.chartId)
  }

  const { data, error } = await query
  if (error) return { data: [], error: error.message }

  const events = (data ?? []) as Omit<ChartAuditEvent, "actor_name">[]
  const actorIds = [...new Set(events.map((e) => e.actor_user_id).filter(Boolean))] as string[]

  const nameMap = new Map<string, string>()
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", actorIds)
    for (const p of profiles ?? []) {
      nameMap.set(p.id, p.full_name ?? p.email ?? "Staff")
    }
  }

  return {
    data: events.map((e) => ({
      ...e,
      before_json: e.before_json as Record<string, unknown> | null,
      after_json: e.after_json as Record<string, unknown> | null,
      actor_name: e.actor_user_id ? nameMap.get(e.actor_user_id) ?? "Staff" : "System",
    })),
    error: null,
  }
}
