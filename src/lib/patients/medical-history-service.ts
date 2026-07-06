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

export async function fetchPendingHistoryUpdate(
  patientId: string
): Promise<{ data: { id: string; medical_alerts: string } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("patient_intakes")
    .select("id, payload")
    .eq("status", "draft")

  if (error) return { data: null, error: error.message }

  const match = (data ?? []).find(
    (row) =>
      row.payload &&
      typeof row.payload === "object" &&
      (row.payload as any).patient_id === patientId &&
      (row.payload as any).source === "kiosk_update"
  )

  if (!match) return { data: null, error: null }

  return {
    data: {
      id: match.id,
      medical_alerts: String((match.payload as any).medical_alerts ?? ""),
    },
    error: null,
  }
}

export async function approveKioskHistoryUpdate(
  intakeId: string,
  patientId: string,
  organizationId: string,
  userId: string,
  medicalAlerts: string
): Promise<{ error: string | null }> {
  const supabase = createClient()

  // Parse text guidelines like "Allergies: Penicillin, Medications: Aspirin"
  // or put everything inside the notes/allergies list.
  // For safety, parse by keywords or place it directly inside notes/allergies:
  const allergies: string[] = []
  const medications: string[] = []
  const conditions: string[] = []

  const lowerAlerts = medicalAlerts.toLowerCase()
  if (lowerAlerts.includes("allergy") || lowerAlerts.includes("allergies")) {
    allergies.push(medicalAlerts)
  }

  // 1. Create new medical history version
  const { error: historyErr } = await saveMedicalHistory({
    patientId,
    organizationId,
    userId,
    allergies,
    medications,
    conditions,
    notes: medicalAlerts,
  })

  if (historyErr) return { error: historyErr }

  // 2. Mark draft as completed/processed
  const { error: intakeErr } = await supabase
    .from("patient_intakes")
    .update({ status: "completed" })
    .eq("id", intakeId)

  return { error: intakeErr?.message ?? null }
}

export async function rejectKioskHistoryUpdate(
  intakeId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("patient_intakes")
    .update({ status: "cancelled" })
    .eq("id", intakeId)

  return { error: error?.message ?? null }
}
