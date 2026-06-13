import { createClient } from "@/lib/supabase/client"
import type { BranchRecord } from "@/lib/auth/permissions"

export async function fetchAllOrgBranches(): Promise<BranchRecord[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_my_branches")

  if (error) {
    console.error("fetchAllOrgBranches failed:", error.message)
    return []
  }

  return (data ?? []) as BranchRecord[]
}

/** Admin settings list — includes inactive branches */
export async function fetchOrgBranchesForSettings(): Promise<BranchRecord[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_org_branches_for_settings")

  if (error) {
    console.error("fetchOrgBranchesForSettings failed:", error.message)
    return fetchAllOrgBranches()
  }

  return (data ?? []) as BranchRecord[]
}

export async function createBranch(payload: {
  name: string
  address?: string
  contact_number?: string
  organization_id: string
}): Promise<{ data: BranchRecord | null; error: string | null }> {
  const supabase = createClient()
  const { data: rpcData, error: rpcError } = await supabase.rpc("create_org_branch", {
    p_name: payload.name,
    p_address: payload.address ?? null,
    p_contact_number: payload.contact_number ?? null,
  })

  if (!rpcError && rpcData && typeof rpcData === "object" && "branch_id" in rpcData) {
    const branchId = (rpcData as { branch_id: string }).branch_id
    const { data, error } = await supabase
      .from("branches")
      .select("id, name, organization_id, address, contact_number, is_active")
      .eq("id", branchId)
      .single()

    if (error) return { data: null, error: error.message }
    return {
      data: { ...data, role_name: "admin" } as BranchRecord,
      error: null,
    }
  }

  // Fallback when migration not applied yet
  const { data, error } = await supabase
    .from("branches")
    .insert({
      name: payload.name,
      address: payload.address ?? null,
      contact_number: payload.contact_number ?? null,
      organization_id: payload.organization_id,
      is_active: true,
    })
    .select("id, name, organization_id, address, contact_number, is_active")
    .single()

  if (error) return { data: null, error: error.message }

  return {
    data: { ...data, role_name: "admin" } as BranchRecord,
    error: null,
  }
}

export async function updateBranch(
  branchId: string,
  payload: { name: string; address?: string | null; contact_number?: string | null }
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("branches")
    .update({
      name: payload.name,
      address: payload.address ?? null,
      contact_number: payload.contact_number ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", branchId)

  return { error: error?.message ?? null }
}

export async function deactivateBranch(
  branchId: string,
  reason: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("deactivate_branch", {
    p_branch_id: branchId,
    p_reason: reason.trim(),
  })

  return { error: error?.message ?? null }
}
