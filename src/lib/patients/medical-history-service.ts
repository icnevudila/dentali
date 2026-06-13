import { createClient } from "@/lib/supabase/client"

export interface MedicalHistoryRecord {
  id: string
  version: number
  allergies: string[]
  medications: string[]
  conditions: string[]
  notes: string | null
  created_at: string
}

export async function getLatestMedicalHistory(
  patientId: string
): Promise<{ data: MedicalHistoryRecord | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("patient_medical_histories")
    .select("*")
    .eq("patient_id", patientId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  if (!data) return { data: null, error: null }

  return {
    data: {
      id: data.id,
      version: data.version,
      allergies: (data.allergies as string[]) ?? [],
      medications: (data.medications as string[]) ?? [],
      conditions: (data.conditions as string[]) ?? [],
      notes: data.notes,
      created_at: data.created_at,
    },
    error: null,
  }
}

export async function saveMedicalHistory(params: {
  patientId: string
  organizationId: string
  userId: string
  branchId?: string
  allergies: string[]
  medications: string[]
  conditions: string[]
  notes?: string
}): Promise<{ data: { version: number } | null; error: string | null }> {
  const supabase = createClient()

  const { data, error } = await supabase.rpc("create_medical_history_version", {
    p_payload: {
      patient_id: params.patientId,
      organization_id: params.organizationId,
      branch_id: params.branchId ?? null,
      allergies: params.allergies,
      medications: params.medications,
      conditions: params.conditions,
      notes: params.notes ?? null,
    },
  })

  if (error) return { data: null, error: error.message }
  const raw = data as { version: number }
  return { data: { version: raw.version }, error: null }
}

export async function fetchMedicalHistoryVersions(
  patientId: string
): Promise<{ data: MedicalHistoryRecord[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("patient_medical_histories")
    .select("*")
    .eq("patient_id", patientId)
    .order("version", { ascending: false })

  if (error) return { data: [], error: error.message }

  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      version: row.version,
      allergies: (row.allergies as string[]) ?? [],
      medications: (row.medications as string[]) ?? [],
      conditions: (row.conditions as string[]) ?? [],
      notes: row.notes,
      created_at: row.created_at,
    })),
    error: null,
  }
}

export interface MedicalRiskFlag {
  code: string
  severity: string
  label: string
}

export interface MedicalRiskAssessment {
  patient_id: string
  flags: MedicalRiskFlag[]
  risk_level: "none" | "medium" | "high"
}

export async function getMedicalRiskFlags(
  patientId: string
): Promise<{ data: MedicalRiskAssessment | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("calculate_medical_risk_flags", {
    p_patient_id: patientId,
  })

  if (error) return { data: null, error: error.message }
  const raw = data as Record<string, unknown>
  return {
    data: {
      patient_id: String(raw.patient_id),
      flags: ((raw.flags as MedicalRiskFlag[]) ?? []),
      risk_level: (raw.risk_level as MedicalRiskAssessment["risk_level"]) ?? "none",
    },
    error: null,
  }
}
