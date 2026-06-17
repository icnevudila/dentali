import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"
import { sendOrgLiveSms } from "./provider-secrets.ts"

export async function branchDryRunMode(
  supabaseAdmin: SupabaseClient,
  branchId: string
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("notification_branch_settings")
    .select("dry_run_mode")
    .eq("branch_id", branchId)
    .maybeSingle()

  return data?.dry_run_mode ?? true
}

export async function logSmsDispatch(params: {
  supabaseAdmin: SupabaseClient
  organizationId: string
  branchId: string
  patientId?: string | null
  templateId: string
  templateKey: string
  phone: string
  body: string
  status: string
}): Promise<void> {
  await params.supabaseAdmin.from("notification_logs").insert({
    organization_id: params.organizationId,
    branch_id: params.branchId,
    patient_id: params.patientId ?? null,
    template_id: params.templateId,
    template_key: params.templateKey,
    recipient_phone: params.phone,
    body_preview: params.body.slice(0, 500),
    status: params.status,
    created_by: null,
  })
}

export async function dispatchBranchSms(params: {
  supabaseAdmin: SupabaseClient
  organizationId: string
  branchId: string
  phone: string
  messageBody: string
  dryRun: boolean
}): Promise<"dry_run" | "sent" | "failed"> {
  if (params.dryRun) return "dry_run"

  const smsResult = await sendOrgLiveSms(params.supabaseAdmin, {
    organizationId: params.organizationId,
    branchId: params.branchId,
    phone: params.phone,
    message: params.messageBody,
  })
  return smsResult.ok ? "sent" : "failed"
}
