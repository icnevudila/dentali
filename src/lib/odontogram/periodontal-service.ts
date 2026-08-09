import { createClient } from "@/lib/supabase/client"
import type { PeriodontalChartData } from "@/lib/odontogram/periodontal-types"
import { mergePeriodontalChart } from "@/lib/odontogram/periodontal-types"
import {
  loadPeriodontalChart,
  savePeriodontalChart,
} from "@/lib/odontogram/periodontal-storage"

export interface PeriodontalPayload {
  chart_id: string | null
  patient_id: string
  branch_id: string
  data: PeriodontalChartData
}

function isMissingRpcError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  const msg = (error.message ?? "").toLowerCase()
  return (
    error.code === "PGRST202" ||
    msg.includes("could not find the function") ||
    msg.includes("schema cache") ||
    (msg.includes("function") && msg.includes("does not exist")) ||
    msg.includes("periodontal_data")
  )
}

function isMissingColumnError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  const msg = (error.message ?? "").toLowerCase()
  return msg.includes("periodontal_data") && msg.includes("does not exist")
}

async function getPatientPeriodontalDirect(
  patientId: string,
  branchId: string
): Promise<{ data: PeriodontalPayload | null; error: string | null }> {
  const supabase = createClient()
  const { data: chart, error } = await supabase
    .from("dental_charts")
    .select("id, patient_id, branch_id, periodontal_data")
    .eq("patient_id", patientId)
    .eq("branch_id", branchId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    if (isMissingColumnError(error)) {
      return {
        data: {
          chart_id: null,
          patient_id: patientId,
          branch_id: branchId,
          data: loadPeriodontalChart(patientId, branchId),
        },
        error: null,
      }
    }
    return { data: null, error: error.message }
  }

  if (!chart) {
    return {
      data: {
        chart_id: null,
        patient_id: patientId,
        branch_id: branchId,
        data: mergePeriodontalChart(null),
      },
      error: null,
    }
  }

  return {
    data: {
      chart_id: chart.id as string,
      patient_id: chart.patient_id as string,
      branch_id: chart.branch_id as string,
      data: mergePeriodontalChart((chart.periodontal_data as PeriodontalChartData) ?? null),
    },
    error: null,
  }
}

export async function getPatientPeriodontal(
  patientId: string,
  branchId: string
): Promise<{ data: PeriodontalPayload | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_patient_periodontal", {
    p_patient_id: patientId,
    p_branch_id: branchId,
  })

  if (isMissingRpcError(error)) {
    return getPatientPeriodontalDirect(patientId, branchId)
  }

  if (error) return { data: null, error: error.message }
  if (!data) {
    return {
      data: {
        chart_id: null,
        patient_id: patientId,
        branch_id: branchId,
        data: mergePeriodontalChart(null),
      },
      error: null,
    }
  }

  const row = data as {
    chart_id: string
    patient_id: string
    branch_id: string
    data: PeriodontalChartData
  }

  return {
    data: {
      chart_id: row.chart_id,
      patient_id: row.patient_id,
      branch_id: row.branch_id,
      data: mergePeriodontalChart(row.data ?? null),
    },
    error: null,
  }
}

async function upsertPatientPeriodontalDirect(params: {
  patientId: string
  branchId: string
  organizationId: string
  actorUserId: string
  chart: PeriodontalChartData
}): Promise<{ data: PeriodontalPayload | null; error: string | null }> {
  const supabase = createClient()

  const existing = await getPatientPeriodontalDirect(params.patientId, params.branchId)
  if (existing.error) return existing

  if (existing.data?.chart_id) {
    const { error } = await supabase
      .from("dental_charts")
      .update({
        periodontal_data: params.chart,
        updated_by: params.actorUserId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.data.chart_id)

    if (error) {
      if (isMissingColumnError(error)) {
        savePeriodontalChart(params.patientId, params.branchId, params.chart)
        return {
          data: {
            chart_id: null,
            patient_id: params.patientId,
            branch_id: params.branchId,
            data: params.chart,
          },
          error: null,
        }
      }
      return { data: null, error: error.message }
    }
  } else {
    const { data: inserted, error } = await supabase
      .from("dental_charts")
      .insert({
        organization_id: params.organizationId,
        branch_id: params.branchId,
        patient_id: params.patientId,
        periodontal_data: params.chart,
        created_by: params.actorUserId,
        updated_by: params.actorUserId,
      })
      .select("id, patient_id, branch_id")
      .single()

    if (error) {
      if (isMissingColumnError(error)) {
        savePeriodontalChart(params.patientId, params.branchId, params.chart)
        return {
          data: {
            chart_id: null,
            patient_id: params.patientId,
            branch_id: params.branchId,
            data: params.chart,
          },
          error: null,
        }
      }
      return { data: null, error: error.message }
    }

    return {
      data: {
        chart_id: inserted.id as string,
        patient_id: inserted.patient_id as string,
        branch_id: inserted.branch_id as string,
        data: params.chart,
      },
      error: null,
    }
  }

  return getPatientPeriodontalDirect(params.patientId, params.branchId)
}

export async function savePatientPeriodontal(params: {
  patientId: string
  branchId: string
  organizationId: string
  actorUserId: string
  chart: PeriodontalChartData
}): Promise<{ data: PeriodontalPayload | null; error: string | null }> {
  savePeriodontalChart(params.patientId, params.branchId, params.chart)

  const supabase = createClient()
  const { data, error } = await supabase.rpc("upsert_patient_periodontal", {
    p_patient_id: params.patientId,
    p_branch_id: params.branchId,
    p_organization_id: params.organizationId,
    p_data: params.chart,
    p_actor_user_id: params.actorUserId,
  })

  if (isMissingRpcError(error)) {
    return upsertPatientPeriodontalDirect(params)
  }

  if (error) return { data: null, error: error.message }

  const row = data as {
    chart_id: string
    patient_id: string
    branch_id: string
    data: PeriodontalChartData
  }

  return {
    data: {
      chart_id: row.chart_id,
      patient_id: row.patient_id,
      branch_id: row.branch_id,
      data: mergePeriodontalChart(row.data ?? null),
    },
    error: null,
  }
}

/** Merge local-only readings into server when server chart is empty. */
export function migrateLocalPeriodontalIfNeeded(
  server: PeriodontalChartData,
  local: PeriodontalChartData
): PeriodontalChartData {
  const serverStats = Object.values(server).some((row) =>
    Object.values(row ?? {}).some((s) => s?.depth != null || s?.bop)
  )
  if (serverStats) return server

  const localStats = Object.values(local).some((row) =>
    Object.values(row ?? {}).some((s) => s?.depth != null || s?.bop)
  )
  if (!localStats) return server

  return mergePeriodontalChart({ ...server, ...local })
}

export type PeriodontalAuditEvent = {
  id: string
  action: string
  created_at: string
  actor_user_id: string | null
  actor_name: string | null
  chart_id: string
  snapshot: PeriodontalChartData
  restore_from_event_id: string | null
}

function extractPeriodontalSnapshot(
  payload: Record<string, unknown> | null
): PeriodontalChartData | null {
  if (!payload || payload.kind !== "periodontal") return null
  const data = payload.data
  if (!data || typeof data !== "object" || Array.isArray(data)) return null
  return mergePeriodontalChart(data as PeriodontalChartData)
}

/** List periodontal audit snapshots (no PHI in console; clinical JSON stays in UI). */
export async function listPeriodontalAuditHistory(params: {
  patientId: string
  branchId: string
  limit?: number
}): Promise<{ data: PeriodontalAuditEvent[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("dental_chart_audit_events")
    .select("id, action, before_json, after_json, created_at, actor_user_id, chart_id")
    .eq("patient_id", params.patientId)
    .eq("branch_id", params.branchId)
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 40)

  if (error) return { data: [], error: error.message }

  const events: PeriodontalAuditEvent[] = []
  for (const row of data ?? []) {
    const after = row.after_json as Record<string, unknown> | null
    const before = row.before_json as Record<string, unknown> | null
    const snapshot = extractPeriodontalSnapshot(after) ?? extractPeriodontalSnapshot(before)
    if (!snapshot) continue
    const restoreFrom =
      (typeof after?.restore_from_event_id === "string" && after.restore_from_event_id) ||
      (typeof before?.restore_from_event_id === "string" && before.restore_from_event_id) ||
      null
    events.push({
      id: row.id as string,
      action: row.action as string,
      created_at: row.created_at as string,
      actor_user_id: (row.actor_user_id as string | null) ?? null,
      actor_name: null,
      chart_id: row.chart_id as string,
      snapshot,
      restore_from_event_id: restoreFrom,
    })
  }

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
      actor_name: e.actor_user_id ? nameMap.get(e.actor_user_id) ?? "Staff" : "System",
    })),
    error: null,
  }
}

export async function restorePatientPeriodontal(params: {
  patientId: string
  branchId: string
  organizationId: string
  actorUserId: string
  auditEventId: string
}): Promise<{ data: PeriodontalPayload | null; error: string | null; restored?: boolean }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("restore_patient_periodontal", {
    p_patient_id: params.patientId,
    p_branch_id: params.branchId,
    p_organization_id: params.organizationId,
    p_audit_event_id: params.auditEventId,
    p_actor_user_id: params.actorUserId,
  })

  if (error) {
    if (isMissingRpcError(error)) {
      return {
        data: null,
        error: "restore_rpc_unavailable",
      }
    }
    return { data: null, error: error.message }
  }

  const row = data as {
    chart_id: string
    patient_id: string
    branch_id: string
    data: PeriodontalChartData
    restored?: boolean
  }

  const merged = mergePeriodontalChart(row.data ?? null)
  savePeriodontalChart(params.patientId, params.branchId, merged)

  return {
    data: {
      chart_id: row.chart_id,
      patient_id: row.patient_id,
      branch_id: row.branch_id,
      data: merged,
    },
    error: null,
    restored: row.restored !== false,
  }
}
