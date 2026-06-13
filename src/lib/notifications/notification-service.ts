import { createClient } from "@/lib/supabase/client"

export interface NotificationTemplate {
  id: string
  template_key: string
  name: string
  channel: string
  body: string
  is_active: boolean
  branch_id: string | null
}

export interface EffectiveNotificationTemplate {
  template_key: string
  name: string
  channel: string
  org_template_id: string
  org_default_body: string
  branch_template_id: string | null
  effective_id: string
  effective_body: string
  is_branch_override: boolean
  is_active: boolean
}

export interface NotificationLog {
  id: string
  template_key: string | null
  recipient_phone: string | null
  body_preview: string
  status: string
  error_message: string | null
  created_at: string
}

export interface NotificationStatus {
  dry_run_mode: boolean
  sent_today: number
  failed_today: number
  dry_run_today: number
}

export const TEMPLATE_VARIABLES: Record<string, string[]> = {
  appointment_reminder: ["patient_name", "clinic_name", "appointment_date", "appointment_time"],
  waitlist_slot: ["patient_name", "clinic_name", "slot_date", "slot_time"],
  payment_reminder: ["patient_name", "clinic_name", "amount"],
  queue_called: ["clinic_name", "queue_code"],
  hygiene_recall: ["patient_name", "clinic_name", "booking_link", "last_visit_date"],
  owner_daily_digest: [
    "clinic_name",
    "date",
    "collected",
    "open_balance",
    "appointments_completed",
    "no_show",
  ],
}

export async function fetchEffectiveNotificationTemplates(
  branchId: string
): Promise<{ data: EffectiveNotificationTemplate[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_effective_notification_templates", {
    p_branch_id: branchId,
  })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as EffectiveNotificationTemplate[], error: null }
}

export async function upsertBranchNotificationTemplate(params: {
  branchId: string
  templateKey: string
  body: string
}): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("upsert_branch_notification_template", {
    p_payload: {
      branch_id: params.branchId,
      template_key: params.templateKey,
      body: params.body,
    },
  })
  return { error: error?.message ?? null }
}

export async function deleteBranchNotificationOverride(
  branchId: string,
  templateKey: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("delete_branch_notification_override", {
    p_branch_id: branchId,
    p_template_key: templateKey,
  })
  return { error: error?.message ?? null }
}

export async function fetchNotificationTemplates(
  organizationId: string
): Promise<{ data: NotificationTemplate[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("notification_templates")
    .select("id, template_key, name, channel, body, is_active, branch_id")
    .eq("organization_id", organizationId)
    .order("name")

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as NotificationTemplate[], error: null }
}

export async function updateNotificationTemplate(
  id: string,
  updates: { body?: string; is_active?: boolean; name?: string }
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("notification_templates")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)

  return { error: error?.message ?? null }
}

export async function fetchNotificationLogs(
  branchId: string,
  limit = 50
): Promise<{ data: NotificationLog[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("notification_logs")
    .select("id, template_key, recipient_phone, body_preview, status, error_message, created_at")
    .eq("branch_id", branchId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as NotificationLog[], error: null }
}

export async function fetchNotificationStatus(
  branchId: string
): Promise<{ data: NotificationStatus | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_notification_status", { p_branch_id: branchId })

  if (error) return { data: null, error: error.message }
  return { data: data as NotificationStatus, error: null }
}

export async function sendTestNotification(
  templateId: string,
  phone: string,
  variables: Record<string, string>,
  branchId: string
): Promise<{ data: { body_preview: string; status: string; dry_run: boolean } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("send_test_notification", {
    p_template_id: templateId,
    p_phone: phone,
    p_variables: variables,
    p_branch_id: branchId,
  })

  if (error) return { data: null, error: error.message }
  return { data: data as { body_preview: string; status: string; dry_run: boolean }, error: null }
}

export async function upsertDryRunMode(
  branchId: string,
  organizationId: string,
  dryRun: boolean
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.from("notification_branch_settings").upsert({
    branch_id: branchId,
    organization_id: organizationId,
    dry_run_mode: dryRun,
    updated_at: new Date().toISOString(),
  })

  return { error: error?.message ?? null }
}

export async function sendAppointmentReminder(
  appointmentId: string
): Promise<{
  data: { log_id: string; status: string; dry_run: boolean; body_preview: string } | null
  error: string | null
}> {
  const supabase = createClient()
  const { data, error } = await supabase.functions.invoke("send-appointment-reminder", {
    body: { appointment_id: appointmentId },
  })

  if (error) return { data: null, error: error.message }
  if (data?.error) return { data: null, error: String(data.error) }
  return {
    data: {
      log_id: String(data.log_id),
      status: String(data.status),
      dry_run: Boolean(data.dry_run),
      body_preview: String(data.body_preview ?? ""),
    },
    error: null,
  }
}

export async function sendSms(params: {
  phone: string
  body: string
  branchId: string
  templateKey?: string
  patientId?: string
}): Promise<{
  data: { log_id: string; status: string; dry_run: boolean; provider_ref: string | null } | null
  error: string | null
}> {
  const supabase = createClient()
  const { data, error } = await supabase.functions.invoke("send-sms", {
    body: {
      phone: params.phone,
      body: params.body,
      branch_id: params.branchId,
      template_key: params.templateKey ?? null,
      patient_id: params.patientId ?? null,
    },
  })

  if (error) return { data: null, error: error.message }
  if (data?.error) return { data: null, error: String(data.error) }
  return {
    data: {
      log_id: String(data.log_id),
      status: String(data.status),
      dry_run: Boolean(data.dry_run),
      provider_ref: data.provider_ref ? String(data.provider_ref) : null,
    },
    error: null,
  }
}

export async function seedNotificationTemplates(
  organizationId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("seed_notification_templates", { p_org_id: organizationId })
  return { error: error?.message ?? null }
}

export function renderPreview(body: string, vars: Record<string, string>): string {
  let result = body
  for (const [key, val] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, val)
  }
  return result
}

export function maskPhone(phone: string | null): string {
  if (!phone) return "—"
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 4) return "••••"
  return `••••${digits.slice(-4)}`
}
