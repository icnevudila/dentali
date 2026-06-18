import { createClient } from "@/lib/supabase/client"
import { fetchOrganization } from "@/lib/auth/auth-service"
import type { PdaIntakeResponses, PdaIntakeStatus } from "@/lib/pda/pda-intake-schema"
import { parsePdaIntakeResponses } from "@/lib/pda/pda-intake-schema"

export interface PdaIntakeRecord {
  id: string
  status: PdaIntakeStatus
  responses: PdaIntakeResponses
  version: number
  completedAt: string | null
  patientSubmittedAt: string | null
  updatedAt: string | null
}

function isMissingRpc(message: string): boolean {
  return (
    message.includes("Could not find the function") ||
    message.includes("PGRST202") ||
    message.includes("schema cache")
  )
}

function isMissingTable(message: string): boolean {
  return (
    message.includes("does not exist") ||
    message.includes("42P01") ||
    (message.includes("patient_pda_intake_records") && message.includes("schema cache"))
  )
}

const MIGRATION_REQUIRED_MSG =
  "PDA tables are not in Supabase yet. Open SQL Editor and run supabase/scripts/APPLY_PDA_INTAKE.sql, then run: NOTIFY pgrst, 'reload schema';"

const SCHEMA_RELOAD_HINT =
  "PDA tables exist but API is not refreshed. Supabase → Project Settings → API → Reload schema."

async function fetchPatientPdaIntakeFromTable(
  patientId: string,
  branchId: string
): Promise<{ data: PdaIntakeRecord | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("patient_pda_intake_records")
    .select("id, status, responses, version, completed_at, patient_submitted_at, updated_at")
    .eq("patient_id", patientId)
    .eq("branch_id", branchId)
    .maybeSingle()

  if (error) {
    if (isMissingTable(error.message)) {
      return { data: null, error: MIGRATION_REQUIRED_MSG }
    }
    return { data: null, error: error.message }
  }
  if (!data) return { data: null, error: null }
  return { data: mapRecord(data as Record<string, unknown>), error: null }
}

async function upsertPatientPdaIntakeViaTable(params: {
  patientId: string
  branchId: string
  responses: PdaIntakeResponses
  status?: PdaIntakeStatus
}): Promise<{ data: { id: string; version: number; status: PdaIntakeStatus } | null; error: string | null }> {
  const org = await fetchOrganization()
  if (!org) return { data: null, error: "Organization not found." }

  const supabase = createClient()
  const status = params.status ?? "draft"
  const now = new Date().toISOString()
  const row = {
    organization_id: org.id,
    branch_id: params.branchId,
    patient_id: params.patientId,
    responses: params.responses,
    status,
    updated_at: now,
    ...(status === "completed" ? { completed_at: now } : {}),
  }

  const { data, error } = await supabase
    .from("patient_pda_intake_records")
    .upsert(row, { onConflict: "patient_id,branch_id" })
    .select("id, version, status")
    .single()

  if (error) {
    if (isMissingTable(error.message)) {
      return { data: null, error: MIGRATION_REQUIRED_MSG }
    }
    return { data: null, error: error.message }
  }

  return {
    data: {
      id: String(data.id),
      version: Number(data.version ?? 1),
      status: (data.status as PdaIntakeStatus) ?? status,
    },
    error: null,
  }
}

function mapRecord(raw: Record<string, unknown> | null): PdaIntakeRecord | null {
  if (!raw || !raw.id) return null
  return {
    id: String(raw.id),
    status: (raw.status as PdaIntakeStatus) ?? "draft",
    responses: parsePdaIntakeResponses(raw.responses),
    version: Number(raw.version ?? 1),
    completedAt: raw.completed_at ? String(raw.completed_at) : null,
    patientSubmittedAt: raw.patient_submitted_at ? String(raw.patient_submitted_at) : null,
    updatedAt: raw.updated_at ? String(raw.updated_at) : null,
  }
}

export async function fetchPatientPdaIntake(
  patientId: string,
  branchId: string
): Promise<{ data: PdaIntakeRecord | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_patient_pda_intake", {
    p_patient_id: patientId,
    p_branch_id: branchId,
  })
  if (error) {
    if (isMissingRpc(error.message)) {
      const fallback = await fetchPatientPdaIntakeFromTable(patientId, branchId)
      if (!fallback.error) return fallback
      return { data: null, error: fallback.error ?? SCHEMA_RELOAD_HINT }
    }
    return { data: null, error: error.message }
  }
  if (!data) return { data: null, error: null }
  return { data: mapRecord(data as Record<string, unknown>), error: null }
}

export async function upsertPatientPdaIntake(params: {
  patientId: string
  branchId: string
  responses: PdaIntakeResponses
  status?: PdaIntakeStatus
}): Promise<{ data: { id: string; version: number; status: PdaIntakeStatus } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("upsert_patient_pda_intake", {
    p_patient_id: params.patientId,
    p_branch_id: params.branchId,
    p_responses: params.responses,
    p_status: params.status ?? "draft",
  })
  if (error) {
    if (isMissingRpc(error.message)) {
      const fallback = await upsertPatientPdaIntakeViaTable(params)
      if (!fallback.error) return fallback
      return { data: null, error: fallback.error ?? SCHEMA_RELOAD_HINT }
    }
    return { data: null, error: error.message }
  }
  const row = data as { id?: string; version?: number; status?: PdaIntakeStatus }
  return {
    data: {
      id: String(row.id),
      version: Number(row.version ?? 1),
      status: row.status ?? "draft",
    },
    error: null,
  }
}

export async function createPdaIntakeSigningToken(params: {
  recordId: string
  channel?: string
  ttlHours?: number
}): Promise<{ token: string | null; expiresAt: string | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("create_pda_intake_signing_token", {
    p_record_id: params.recordId,
    p_channel: params.channel ?? "link",
    p_ttl_hours: params.ttlHours ?? 72,
  })
  if (error) {
    if (isMissingRpc(error.message)) {
      return { token: null, expiresAt: null, error: SCHEMA_RELOAD_HINT }
    }
    return { token: null, expiresAt: null, error: error.message }
  }
  const row = data as { token?: string; expires_at?: string }
  return {
    token: row.token ?? null,
    expiresAt: row.expires_at ?? null,
    error: null,
  }
}

export interface PdaIntakeTokenContext {
  recordId: string
  status: PdaIntakeStatus
  responses: PdaIntakeResponses
  patientFirstName: string
  patientLastName: string
  orgName: string
}

export async function fetchPdaIntakeByToken(
  token: string
): Promise<{ data: PdaIntakeTokenContext | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_pda_intake_by_token", { p_token: token })
  if (error) return { data: null, error: error.message }
  const row = data as Record<string, unknown>
  return {
    data: {
      recordId: String(row.record_id),
      status: (row.status as PdaIntakeStatus) ?? "draft",
      responses: parsePdaIntakeResponses(row.responses),
      patientFirstName: String(row.patient_first_name ?? ""),
      patientLastName: String(row.patient_last_name ?? ""),
      orgName: String(row.org_name ?? "Clinic"),
    },
    error: null,
  }
}

export async function submitPdaIntakeViaToken(
  token: string,
  responses: PdaIntakeResponses
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("submit_pda_intake_via_token", {
    p_token: token,
    p_responses: responses,
  })
  return { error: error?.message ?? null }
}
