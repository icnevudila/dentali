import { createClient } from "@/lib/supabase/client"

export const PHILHEALTH_CHECKLIST_KEYS = [
  { key: "philhealth_id", label: "PhilHealth ID verified" },
  { key: "member_category", label: "Member category documented" },
  { key: "case_rate", label: "Case rate code selected" },
  { key: "clinical_notes", label: "Clinical notes attached" },
  { key: "consent_signed", label: "Consent form signed" },
  { key: "cf4_ready", label: "CF4 fields complete" },
] as const

export interface PhilHealthClaim {
  id: string
  patient_id: string
  patient_name?: string
  philhealth_id: string | null
  case_rate_code: string | null
  status: string
  checklist: Record<string, boolean>
  provider_ref: string | null
  submitted_at: string | null
  created_at: string
}

export interface PhilHealthSyncLog {
  id: string
  status: string
  mode: string | null
  response_summary: string | null
  created_at: string
}

export function checklistComplete(checklist: Record<string, boolean>): boolean {
  return PHILHEALTH_CHECKLIST_KEYS.every((k) => checklist[k.key] === true)
}

export async function fetchPhilHealthClaims(
  branchId: string
): Promise<{ data: PhilHealthClaim[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("philhealth_claims")
    .select("id, patient_id, philhealth_id, case_rate_code, status, checklist, provider_ref, submitted_at, created_at, patients(first_name, last_name)")
    .eq("branch_id", branchId)
    .order("created_at", { ascending: false })

  if (error) return { data: [], error: error.message }

  return {
    data: (data ?? []).map((row) => {
      const p = row.patients as { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
      const patient = Array.isArray(p) ? p[0] : p
      return {
        id: row.id,
        patient_id: row.patient_id,
        patient_name: patient ? `${patient.first_name} ${patient.last_name}` : undefined,
        philhealth_id: row.philhealth_id,
        case_rate_code: row.case_rate_code,
        status: row.status,
        checklist: (row.checklist ?? {}) as Record<string, boolean>,
        provider_ref: row.provider_ref ?? null,
        submitted_at: row.submitted_at ?? null,
        created_at: row.created_at,
      }
    }),
    error: null,
  }
}

export async function createPhilHealthClaim(params: {
  organizationId: string
  branchId: string
  patientId: string
  philhealthId: string
  caseRateCode: string
  userId: string
}): Promise<{ data: { id: string } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("philhealth_claims")
    .insert({
      organization_id: params.organizationId,
      branch_id: params.branchId,
      patient_id: params.patientId,
      philhealth_id: params.philhealthId,
      case_rate_code: params.caseRateCode,
      status: "checklist_incomplete",
      created_by: params.userId,
    })
    .select("id")
    .single()

  if (error || !data) return { data: null, error: error?.message ?? "Failed" }
  return { data: { id: data.id }, error: null }
}

export async function updatePhilHealthChecklist(
  claimId: string,
  checklist: Record<string, boolean>
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const status = checklistComplete(checklist) ? "ready" : "checklist_incomplete"
  const { error } = await supabase
    .from("philhealth_claims")
    .update({ checklist, status, updated_at: new Date().toISOString() })
    .eq("id", claimId)

  return { error: error?.message ?? null }
}

export type PhilHealthSyncResult = {
  dry_run?: boolean
  /** Edge function unavailable — local stub RPC was used instead. */
  stub_fallback?: boolean
  provider_ref?: string
  sync_log_id?: string
}

export async function syncPhilHealthClaim(
  claimId: string
): Promise<{ data: PhilHealthSyncResult | null; error: string | null }> {
  const supabase = createClient()

  try {
    const { data, error } = await supabase.functions.invoke("sync-philhealth-claim", {
      body: { claim_id: claimId },
    })

    if (!error && data) {
      const payload = data as { error?: string; success?: boolean; dry_run?: boolean; provider_ref?: string; sync_log_id?: string }
      if (payload?.error) return { data: null, error: payload.error }

      return {
        data: {
          dry_run: payload.dry_run,
          provider_ref: payload.provider_ref,
          sync_log_id: payload.sync_log_id,
        },
        error: null,
      }
    }
  } catch {
    // Fall back to local database simulation if edge function fails to connect/is missing
  }

  const { data: dbRes, error: dbErr } = await supabase.rpc("queue_philhealth_sync", {
    p_claim_id: claimId,
  })

  if (dbErr) return { data: null, error: dbErr.message }
  const raw = dbRes as { sync_log_id?: string; status?: string }

  return {
    data: {
      dry_run: true,
      stub_fallback: true,
      provider_ref: "STUB-" + claimId.slice(0, 8).toUpperCase(),
      sync_log_id: raw.sync_log_id,
    },
    error: null,
  }
}

/** @deprecated Use syncPhilHealthClaim — RPC stub kept for backwards compatibility */
export async function queuePhilHealthSync(claimId: string): Promise<{ error: string | null }> {
  const { error } = await syncPhilHealthClaim(claimId)
  return { error }
}

export async function resetPhilHealthClaimForRetry(
  claimId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("reset_philhealth_claim_for_retry", {
    p_claim_id: claimId,
  })
  return { error: error?.message ?? null }
}

export async function fetchPhilHealthSyncLogs(
  claimId: string
): Promise<{ data: PhilHealthSyncLog[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("philhealth_sync_logs")
    .select("id, status, mode, response_summary, created_at")
    .eq("claim_id", claimId)
    .order("created_at", { ascending: false })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as PhilHealthSyncLog[], error: null }
}
