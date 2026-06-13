import { createClient } from "@/lib/supabase/client"

export interface BranchContext {
  branch_id: string
  branch_name: string
  organization_id: string
  is_active: boolean
  timezone: string
  currency_code: string
  branch_overrides: Record<string, string>
}

export interface EffectiveSettings extends BranchContext {
  clinic_hours: {
    day_of_week: number
    open_time: string
    close_time: string
    is_closed: boolean
  }[]
}

export async function fetchBranchContext(
  branchId: string
): Promise<{ data: BranchContext | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_branch_context", { p_branch_id: branchId })

  if (error) return { data: null, error: error.message }
  if (!data) return { data: null, error: "Branch context not found" }

  const raw = data as Record<string, unknown>
  return {
    data: {
      branch_id: String(raw.branch_id),
      branch_name: String(raw.branch_name),
      organization_id: String(raw.organization_id),
      is_active: Boolean(raw.is_active ?? true),
      timezone: String(raw.timezone ?? "Asia/Manila"),
      currency_code: String(raw.currency_code ?? "PHP"),
      branch_overrides: (raw.branch_overrides ?? {}) as Record<string, string>,
    },
    error: null,
  }
}

export async function fetchEffectiveSettings(
  branchId: string
): Promise<{ data: EffectiveSettings | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_effective_settings", { p_branch_id: branchId })

  if (error) return { data: null, error: error.message }
  if (!data) return { data: null, error: "Settings not found" }

  const raw = data as Record<string, unknown>
  return {
    data: {
      branch_id: String(raw.branch_id),
      branch_name: String(raw.branch_name),
      organization_id: String(raw.organization_id),
      is_active: true,
      timezone: String(raw.timezone ?? "Asia/Manila"),
      currency_code: String(raw.currency_code ?? "PHP"),
      branch_overrides: (raw.branch_overrides ?? {}) as Record<string, string>,
      clinic_hours: (raw.clinic_hours ?? []) as EffectiveSettings["clinic_hours"],
    },
    error: null,
  }
}

export async function saveBranchRegionalOverrides(
  branchId: string,
  params: { timezone?: string; currencyCode?: string }
): Promise<{ error: string | null }> {
  const supabase = createClient()

  if (params.timezone) {
    const { error } = await supabase.rpc("set_branch_setting", {
      p_branch_id: branchId,
      p_key: "timezone",
      p_value: params.timezone,
    })
    if (error) return { error: error.message }
  }

  if (params.currencyCode) {
    const { error } = await supabase.rpc("set_branch_setting", {
      p_branch_id: branchId,
      p_key: "currency_code",
      p_value: params.currencyCode,
    })
    if (error) return { error: error.message }
  }

  return { error: null }
}
