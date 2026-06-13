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
}): Promise<{ data: AppointmentSlot[]; error: string | null }> {
  const supabase = createClient()

  // 1. Get Day of Week
  const targetDate = new Date(params.date)
  const dow = targetDate.getDay() // 0 = Sunday, 1 = Monday, etc.

  // 2. Fetch Availability
  const { data: availData, error: availErr } = await supabase
    .from("provider_availability")
    .select("start_time, end_time, slot_minutes, is_available")
    .eq("branch_id", params.branchId)
    .eq("provider_id", params.providerId)
    .eq("day_of_week", dow)
    .limit(1)
    .maybeSingle()

  if (availErr) return { data: [], error: availErr.message }

  // If no specific availability record, check clinic hours as fallback
  let start_time = availData?.start_time
  let end_time = availData?.end_time
  let slot_minutes = availData?.slot_minutes || 30
  let is_available = availData?.is_available

  if (!availData) {
    const { data: clinicData } = await supabase
      .from("clinic_hours")
      .select("open_time, close_time, is_closed")
      .eq("branch_id", params.branchId)
      .eq("day_of_week", dow)
      .limit(1)
      .maybeSingle()

    if (!clinicData || clinicData.is_closed) {
      return { data: [], error: null }
    }
    start_time = clinicData.open_time || "09:00:00"
    end_time = clinicData.close_time || "17:00:00"
    is_available = true
  } else if (!is_available) {
    return { data: [], error: null }
  }

  if (!start_time || !end_time) return { data: [], error: null }

  // 3. Fetch Appointments for the day
  const startOfDay = `${params.date}T00:00:00+08:00`
  const endOfDay = `${params.date}T23:59:59+08:00`

  const { data: aptData, error: aptErr } = await supabase
    .from("appointments")
    .select("scheduled_at, status")
    .eq("branch_id", params.branchId)
    .eq("provider_id", params.providerId)
    .gte("scheduled_at", startOfDay)
    .lte("scheduled_at", endOfDay)
    .neq("status", "cancelled")
    .neq("status", "no_show")

  if (aptErr) return { data: [], error: aptErr.message }

  const takenTimes = new Set(
    (aptData || []).map((a) => {
      const d = new Date(a.scheduled_at)
      return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`
    })
  )

  // 4. Generate Slots
  const slots: AppointmentSlot[] = []
  
  const parseTime = (t: string) => {
    const [h, m] = t.split(":")
    return parseInt(h) * 60 + parseInt(m)
  }
  
  let currentMins = parseTime(start_time)
  const endMins = parseTime(end_time)

  while (currentMins < endMins) {
    const hh = Math.floor(currentMins / 60).toString().padStart(2, "0")
    const mm = (currentMins % 60).toString().padStart(2, "0")
    const timeStr = `${hh}:${mm}`
    
    slots.push({
      time: timeStr,
      available: !takenTimes.has(timeStr)
    })
    
    currentMins += slot_minutes
  }

  return { data: slots, error: null }
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
