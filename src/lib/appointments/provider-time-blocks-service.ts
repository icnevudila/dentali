import { createClient } from "@/lib/supabase/client"

export type ProviderTimeBlock = {
  id: string
  branch_id: string
  provider_id: string
  starts_at: string
  ends_at: string
  reason: string | null
}

export async function fetchProviderTimeBlocks(
  branchId: string,
  rangeStart: string,
  rangeEnd: string
): Promise<{ data: ProviderTimeBlock[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("provider_time_blocks")
    .select("id, branch_id, provider_id, starts_at, ends_at, reason")
    .eq("branch_id", branchId)
    .lt("starts_at", rangeEnd)
    .gt("ends_at", rangeStart)
    .order("starts_at", { ascending: true })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as ProviderTimeBlock[], error: null }
}

export async function createProviderTimeBlock(params: {
  branchId: string
  providerId: string
  startsAt: string
  endsAt: string
  reason?: string
}): Promise<{ data: { id: string } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("create_provider_time_block", {
    p_branch_id: params.branchId,
    p_provider_id: params.providerId,
    p_starts_at: params.startsAt,
    p_ends_at: params.endsAt,
    p_reason: params.reason ?? null,
  })
  if (error) return { data: null, error: error.message }
  return { data: { id: (data as { id: string }).id }, error: null }
}

export async function deleteProviderTimeBlock(
  blockId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("delete_provider_time_block", {
    p_block_id: blockId,
  })
  return { error: error?.message ?? null }
}
