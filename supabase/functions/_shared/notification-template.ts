import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"

export interface ResolvedNotificationTemplate {
  id: string
  body: string
  is_branch_override: boolean
}

export async function resolveBranchNotificationTemplate(
  supabaseAdmin: SupabaseClient,
  branchId: string,
  templateKey: string
): Promise<ResolvedNotificationTemplate | null> {
  const { data, error } = await supabaseAdmin.rpc("get_notification_template_for_branch", {
    p_branch_id: branchId,
    p_template_key: templateKey,
  })

  if (error || !data) return null

  const raw = data as { id?: string; body?: string; is_branch_override?: boolean }
  if (!raw.id || !raw.body) return null

  return {
    id: String(raw.id),
    body: String(raw.body),
    is_branch_override: Boolean(raw.is_branch_override),
  }
}
