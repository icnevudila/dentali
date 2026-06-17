import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"
import { sendLiveSms, type SmsSendResult } from "./sms-provider.ts"

export async function resolveSemaphoreApiKey(
  supabaseAdmin: SupabaseClient,
  organizationId: string
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("organization_notification_providers")
    .select("semaphore_api_key")
    .eq("organization_id", organizationId)
    .maybeSingle()

  const dbKey = data?.semaphore_api_key?.trim()
  if (dbKey) return dbKey
  return Deno.env.get("SEMAPHORE_API_KEY")?.trim() ?? null
}

export async function resolveResendApiKey(
  supabaseAdmin: SupabaseClient,
  organizationId: string
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("organization_notification_providers")
    .select("resend_api_key")
    .eq("organization_id", organizationId)
    .maybeSingle()

  const dbKey = data?.resend_api_key?.trim()
  if (dbKey) return dbKey
  return Deno.env.get("RESEND_API_KEY")?.trim() ?? null
}

export async function sendOrgLiveSms(
  supabaseAdmin: SupabaseClient,
  params: {
    organizationId: string
    branchId: string
    phone: string
    message: string
  }
): Promise<SmsSendResult> {
  const apiKey = await resolveSemaphoreApiKey(supabaseAdmin, params.organizationId)
  if (!apiKey) {
    return {
      ok: false,
      error: "SMS provider not configured. Add Semaphore API key in Settings → Notifications → Channels.",
    }
  }

  const { data: branchSettings } = await supabaseAdmin
    .from("notification_branch_settings")
    .select("sms_sender_name")
    .eq("branch_id", params.branchId)
    .maybeSingle()

  return sendLiveSms(
    params.phone,
    params.message,
    branchSettings?.sms_sender_name ?? null,
    apiKey
  )
}
