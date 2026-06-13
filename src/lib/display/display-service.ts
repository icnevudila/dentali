import { createClient } from "@/lib/supabase/client"

export type PublicQueueDisplayItem = {
  display_code: string
  masked_name?: string | null
}

export interface PublicQueueDisplay {
  branch_id?: string
  branch_name: string
  now_serving: PublicQueueDisplayItem[]
  waiting: PublicQueueDisplayItem[]
  updated_at: string
}

export async function fetchPublicQueueDisplay(
  token: string
): Promise<{ data: PublicQueueDisplay | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_public_queue_display", { p_token: token })

  if (error) return { data: null, error: error.message }
  return { data: data as PublicQueueDisplay, error: null }
}

/** PII-free heartbeat for owner TV uptime metrics (VA-F4-24) */
export async function recordDisplayHeartbeat(token: string): Promise<void> {
  if (!token) return
  const supabase = createClient()
  await supabase.rpc("record_display_heartbeat", { p_token: token })
}
