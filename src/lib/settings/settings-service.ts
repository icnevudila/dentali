import { createClient } from "@/lib/supabase/client"

export interface ClinicHourRow {
  day_of_week: number
  open_time: string | null
  close_time: string | null
  is_closed: boolean
}

export interface EffectiveSettings {
  branch_id: string
  branch_name: string
  organization_id: string
  timezone: string
  currency_code: string
  branch_overrides: Record<string, string>
  clinic_hours: ClinicHourRow[]
}

export async function fetchEffectiveSettings(
  branchId: string
): Promise<{ data: EffectiveSettings | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_effective_settings", {
    p_branch_id: branchId,
  })

  if (error) return { data: null, error: error.message }
  return { data: data as EffectiveSettings, error: null }
}
