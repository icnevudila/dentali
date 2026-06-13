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
