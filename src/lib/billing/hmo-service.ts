import { createClient } from "@/lib/supabase/client"

export type HmoClaimStatus = "draft" | "submitted" | "under_review" | "approved" | "rejected" | "paid"

export interface HmoProvider {
  id: string
  name: string
  code: string | null
}

export interface HmoClaim {
  id: string
  patient_id: string
  patient_name?: string
  provider_id: string | null
  provider_name?: string
  invoice_id: string | null
  member_id: string | null
  claim_number: string | null
  claimed_amount: number
  approved_amount: number | null
  status: HmoClaimStatus
  rejection_reason: string | null
  provider_ref: string | null
  submitted_at: string | null
  created_at: string
}

export async function fetchHmoProviders(
  organizationId: string
): Promise<{ data: HmoProvider[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("hmo_providers")
    .select("id, name, code")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("name")

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as HmoProvider[], error: null }
}

export async function fetchHmoClaims(
  branchId: string
): Promise<{ data: HmoClaim[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("hmo_claims")
    .select(
      "id, patient_id, provider_id, invoice_id, member_id, claim_number, claimed_amount, approved_amount, status, rejection_reason, provider_ref, submitted_at, created_at, patients(first_name, last_name), hmo_providers(name)"
    )
    .eq("branch_id", branchId)
    .order("created_at", { ascending: false })

  if (error) return { data: [], error: error.message }

  return {
    data: (data ?? []).map((row) => {
      const p = row.patients as { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
      const patient = Array.isArray(p) ? p[0] : p
      const prov = row.hmo_providers as { name: string } | { name: string }[] | null
      const provider = Array.isArray(prov) ? prov[0] : prov
      return {
        id: row.id,
        patient_id: row.patient_id,
        patient_name: patient ? `${patient.first_name} ${patient.last_name}` : undefined,
        provider_id: row.provider_id,
        provider_name: provider?.name,
        invoice_id: row.invoice_id,
        member_id: row.member_id,
        claim_number: row.claim_number,
        claimed_amount: Number(row.claimed_amount),
        approved_amount: row.approved_amount != null ? Number(row.approved_amount) : null,
        status: row.status as HmoClaimStatus,
        rejection_reason: row.rejection_reason,
        provider_ref: row.provider_ref ?? null,
        submitted_at: row.submitted_at ?? null,
        created_at: row.created_at,
      }
    }),
    error: null,
  }
}

export async function createHmoClaim(params: {
  organizationId: string
  branchId: string
  patientId: string
  providerId: string
  invoiceId?: string
  memberId?: string
  claimedAmount: number
  userId: string
}): Promise<{ data: { id: string } | null; error: string | null }> {
  const supabase = createClient()
  const claimNumber = `HMO-${Date.now().toString(36).toUpperCase()}`
  const { data, error } = await supabase
    .from("hmo_claims")
    .insert({
      organization_id: params.organizationId,
      branch_id: params.branchId,
      patient_id: params.patientId,
      provider_id: params.providerId,
      invoice_id: params.invoiceId ?? null,
      member_id: params.memberId ?? null,
      claim_number: claimNumber,
      claimed_amount: params.claimedAmount,
      created_by: params.userId,
    })
    .select("id")
    .single()

  if (error || !data) return { data: null, error: error?.message ?? "Failed" }
  return { data: { id: data.id }, error: null }
}

export async function submitHmoClaim(
  claimId: string
): Promise<{ data: { provider_ref: string } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("submit_hmo_claim", { p_claim_id: claimId })
  if (error) return { data: null, error: error.message }
  const raw = data as { provider_ref?: string }
  return { data: { provider_ref: String(raw.provider_ref ?? "") }, error: null }
}

export async function resetHmoClaimToDraft(claimId: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("reset_hmo_claim_to_draft", { p_claim_id: claimId })
  return { error: error?.message ?? null }
}

export async function approveHmoClaim(claimId: string, amount: number): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("approve_hmo_claim", { p_claim_id: claimId, p_amount: amount })
  return { error: error?.message ?? null }
}

export async function rejectHmoClaim(claimId: string, reason: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("reject_hmo_claim", { p_claim_id: claimId, p_reason: reason })
  return { error: error?.message ?? null }
}

export async function markHmoClaimPaid(claimId: string, paymentRef: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("mark_hmo_claim_paid", { p_claim_id: claimId, p_payment_ref: paymentRef })
  return { error: error?.message ?? null }
}
