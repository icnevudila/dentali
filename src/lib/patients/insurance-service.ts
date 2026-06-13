import { createClient } from "@/lib/supabase/client"

export interface PatientInsuranceProfile {
  id: string
  payer_type: "none" | "hmo" | "philhealth" | "private"
  payer_name: string | null
  member_id: string | null
  plan_name: string | null
  is_primary: boolean
  notes: string | null
}

export async function fetchPatientInsuranceProfiles(
  patientId: string
): Promise<{ data: PatientInsuranceProfile[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_patient_insurance_profiles", {
    p_patient_id: patientId,
  })

  if (error) return { data: [], error: error.message }
  const raw = data as { profiles?: PatientInsuranceProfile[] }
  return { data: raw.profiles ?? [], error: null }
}

export async function upsertPatientInsuranceProfile(params: {
  organizationId: string
  patientId: string
  payerType: PatientInsuranceProfile["payer_type"]
  payerName?: string
  memberId?: string
  planName?: string
  notes?: string
}): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("upsert_patient_insurance_profile", {
    p_payload: {
      organization_id: params.organizationId,
      patient_id: params.patientId,
      payer_type: params.payerType,
      payer_name: params.payerName ?? null,
      member_id: params.memberId ?? null,
      plan_name: params.planName ?? null,
      notes: params.notes ?? null,
      is_primary: true,
    },
  })

  return { error: error?.message ?? null }
}
