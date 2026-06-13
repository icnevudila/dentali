import { createClient } from "@/lib/supabase/client"

export interface ClinicHourRow {
  id: string
  branch_id: string
  day_of_week: number
  open_time: string | null
  close_time: string | null
  is_closed: boolean
}

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

export { DAY_LABELS }

export async function fetchClinicHours(
  branchId: string
): Promise<{ data: ClinicHourRow[]; error: string | null }> {
  const supabase = createClient()

  await supabase.rpc("ensure_branch_clinic_hours", { p_branch_id: branchId })

  const { data, error } = await supabase
    .from("clinic_hours")
    .select("*")
    .eq("branch_id", branchId)
    .order("day_of_week")

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as ClinicHourRow[], error: null }
}

export async function updateClinicHour(
  hourId: string,
  payload: Partial<Pick<ClinicHourRow, "open_time" | "close_time" | "is_closed">>
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.from("clinic_hours").update(payload).eq("id", hourId)
  return { error: error?.message ?? null }
}
