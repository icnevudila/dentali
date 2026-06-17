import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"
import { resolveResendApiKey } from "./provider-secrets.ts"

export type BranchChannelSettings = {
  clinic_display_name: string
  email_from_address: string | null
  email_reply_to: string | null
  email_dry_run_mode: boolean
  sms_sender_name: string
  dry_run_mode: boolean
}

export async function fetchBranchChannelSettings(
  supabaseAdmin: SupabaseClient,
  branchId: string
): Promise<BranchChannelSettings | null> {
  const { data: branch } = await supabaseAdmin
    .from("branches")
    .select("name")
    .eq("id", branchId)
    .maybeSingle()

  const { data: settings } = await supabaseAdmin
    .from("notification_branch_settings")
    .select(
      "clinic_display_name, email_from_address, email_reply_to, email_dry_run_mode, sms_sender_name, dry_run_mode"
    )
    .eq("branch_id", branchId)
    .maybeSingle()

  const displayName =
    (settings?.clinic_display_name?.trim() || branch?.name || "Dental Clinic").slice(0, 120)

  return {
    clinic_display_name: displayName,
    email_from_address: settings?.email_from_address?.trim() || null,
    email_reply_to: settings?.email_reply_to?.trim() || null,
    email_dry_run_mode: settings?.email_dry_run_mode ?? true,
    sms_sender_name: (settings?.sms_sender_name?.trim() || "dentali").slice(0, 11),
    dry_run_mode: settings?.dry_run_mode ?? true,
  }
}

export function buildEmailFromHeader(
  settings: BranchChannelSettings | null,
  envFallback?: string | null
): string {
  const envFrom = envFallback?.trim() || Deno.env.get("CLOSEOUT_EMAIL_FROM")?.trim()
  if (settings?.email_from_address) {
    return `${settings.clinic_display_name} <${settings.email_from_address}>`
  }
  if (envFrom) return envFrom
  return `${settings?.clinic_display_name ?? "Dentali"} <onboarding@resend.dev>`
}

export function emailShouldDryRun(settings: BranchChannelSettings | null): boolean {
  if (Deno.env.get("CLOSEOUT_EMAIL_DRY_RUN") === "true") return true
  return settings?.email_dry_run_mode ?? true
}

export async function emailShouldDryRunForOrg(
  supabaseAdmin: SupabaseClient,
  organizationId: string,
  settings: BranchChannelSettings | null
): Promise<boolean> {
  if (Deno.env.get("CLOSEOUT_EMAIL_DRY_RUN") === "true") return true
  if (settings?.email_dry_run_mode ?? true) return true
  const apiKey = await resolveResendApiKey(supabaseAdmin, organizationId)
  return !apiKey
}
