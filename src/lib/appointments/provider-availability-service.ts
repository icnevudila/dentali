import { createClient } from "@/lib/supabase/client"

export interface ProviderAvailabilityRow {
  provider_id: string
  provider_name: string
  day_of_week: number
  start_time: string
  end_time: string
  slot_minutes: number
  is_available: boolean
}

export interface AppointmentSlot {
  time: string
  available: boolean
}

export async function fetchBranchProviderAvailability(
  branchId: string
): Promise<{ data: ProviderAvailabilityRow[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_branch_provider_availability", {
    p_branch_id: branchId,
  })

  if (error) return { data: [], error: error.message }
  const raw = data as { rows?: ProviderAvailabilityRow[] }
  return { data: raw.rows ?? [], error: null }
}

export async function fetchAvailableAppointmentSlots(params: {
  branchId: string
  providerId: string
  date: string
  excludeAppointmentId?: string
}): Promise<{ data: AppointmentSlot[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_available_appointment_slots", {
    p_branch_id: params.branchId,
    p_provider_id: params.providerId,
    p_date: params.date,
    p_exclude_appointment_id: params.excludeAppointmentId ?? null,
  })

  if (error) return { data: [], error: error.message }

  const raw = data as { slots?: AppointmentSlot[] }
  return { data: raw.slots ?? [], error: null }
}

export interface ProviderAvailabilityInput {
  day_of_week: number
  start_time: string
  end_time: string
  slot_minutes: number
  is_available: boolean
}

export async function bulkUpdateProviderAvailability(params: {
  branchId: string
  providerId: string
  rows: ProviderAvailabilityInput[]
}): Promise<{ data: { updated: number } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("bulk_upsert_provider_availability", {
    p_branch_id: params.branchId,
    p_provider_id: params.providerId,
    p_rows: params.rows,
  })
  if (error) return { data: null, error: error.message }
  const raw = data as { updated?: number }
  return { data: { updated: Number(raw.updated ?? 0) }, error: null }
}

export async function ensureProviderAvailabilityDefaults(
  branchId: string,
  providerId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("ensure_provider_availability_defaults", {
    p_branch_id: branchId,
    p_provider_id: providerId,
  })
  return { error: error?.message ?? null }
}
