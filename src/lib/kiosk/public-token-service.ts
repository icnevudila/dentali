import { createClient } from "@/lib/supabase/client"

export type PublicTokenType = "kiosk" | "display" | "portal"

export interface BranchPublicTokenRow {
  id: string
  token_type: PublicTokenType
  label: string | null
  is_active: boolean
  created_at: string
  expires_at: string | null
  token_suffix: string
  last_display_ping_at: string | null
  display_ping_count: number | null
  last_kiosk_session_at: string | null
}

export async function listBranchPublicTokens(
  branchId: string
): Promise<{ data: BranchPublicTokenRow[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("list_branch_public_tokens", {
    p_branch_id: branchId,
  })
  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as BranchPublicTokenRow[], error: null }
}

export async function revokeBranchPublicToken(
  tokenId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("revoke_branch_public_token", {
    p_token_id: tokenId,
  })
  return { error: error?.message ?? null }
}

export async function revokeStaleBranchPublicTokens(params: {
  branchId: string
  tokenType: PublicTokenType
  keepCount?: number
  preferRecentPing?: boolean
}): Promise<{ data: { revoked: number; kept: number } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("revoke_branch_public_tokens", {
    p_branch_id: params.branchId,
    p_token_type: params.tokenType,
    p_keep_count: params.keepCount ?? 1,
    p_prefer_recent_ping: params.preferRecentPing ?? true,
  })
  if (error) return { data: null, error: error.message }
  const raw = data as { revoked?: number; kept?: number }
  return {
    data: { revoked: Number(raw.revoked ?? 0), kept: Number(raw.kept ?? 0) },
    error: null,
  }
}
