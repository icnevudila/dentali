import { createClient } from "@/lib/supabase/client"

export interface OrganizationPreferences {
  branch_procedure_pricing_enabled: boolean
  custom_procedure_show_price: boolean
  branch_count: number
}

export async function fetchOrganizationPreferences(): Promise<{
  data: OrganizationPreferences | null
  error: string | null
}> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_organization_preferences")
  if (error) return { data: null, error: error.message }
  const raw = data as Record<string, unknown>
  return {
    data: {
      branch_procedure_pricing_enabled: Boolean(raw.branch_procedure_pricing_enabled),
      custom_procedure_show_price: Boolean(raw.custom_procedure_show_price),
      branch_count: Number(raw.branch_count ?? 0),
    },
    error: null,
  }
}

export async function updateOrganizationPreferences(
  patch: Partial<Pick<OrganizationPreferences, "branch_procedure_pricing_enabled" | "custom_procedure_show_price">>
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("update_organization_preferences", {
    p_preferences: patch,
  })
  return { error: error?.message ?? null }
}
