import { createClient } from "@/lib/supabase/client"

export type StaffTimeEntry = {
  id: string
  branch_id: string
  clock_in_at: string
  clock_out_at: string | null
  note: string | null
}

export async function clockInStaff(
  branchId: string,
  note?: string
): Promise<{ data: { id: string; clock_in_at: string } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("clock_in_staff", {
    p_branch_id: branchId,
    p_note: note ?? null,
  })
  if (error) return { data: null, error: error.message }
  const raw = data as Record<string, unknown>
  return {
    data: {
      id: String(raw.id),
      clock_in_at: String(raw.clock_in_at),
    },
    error: null,
  }
}

export async function clockOutStaff(
  note?: string
): Promise<{
  data: { id: string; clock_in_at: string; clock_out_at: string } | null
  error: string | null
}> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("clock_out_staff", {
    p_note: note ?? null,
  })
  if (error) return { data: null, error: error.message }
  const raw = data as Record<string, unknown>
  return {
    data: {
      id: String(raw.id),
      clock_in_at: String(raw.clock_in_at),
      clock_out_at: String(raw.clock_out_at),
    },
    error: null,
  }
}

export async function fetchOpenTimeEntry(): Promise<{
  data: StaffTimeEntry | null
  error: string | null
}> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: "Not authenticated" }

  const { data, error } = await supabase
    .from("staff_time_entries")
    .select("id, branch_id, clock_in_at, clock_out_at, note")
    .eq("profile_id", user.id)
    .is("clock_out_at", null)
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  if (!data) return { data: null, error: null }

  return {
    data: {
      id: data.id,
      branch_id: data.branch_id,
      clock_in_at: data.clock_in_at,
      clock_out_at: data.clock_out_at,
      note: data.note,
    },
    error: null,
  }
}

export async function fetchRecentTimeEntries(
  limit = 30
): Promise<{ data: StaffTimeEntry[]; error: string | null }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: [], error: "Not authenticated" }

  const { data, error } = await supabase
    .from("staff_time_entries")
    .select("id, branch_id, clock_in_at, clock_out_at, note")
    .eq("profile_id", user.id)
    .order("clock_in_at", { ascending: false })
    .limit(limit)

  if (error) return { data: [], error: error.message }

  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      branch_id: row.branch_id,
      clock_in_at: row.clock_in_at,
      clock_out_at: row.clock_out_at,
      note: row.note,
    })),
    error: null,
  }
}

export function formatDurationMinutes(clockIn: string, clockOut: string | null): string {
  if (!clockOut) return "—"
  const start = new Date(clockIn).getTime()
  const end = new Date(clockOut).getTime()
  const minutes = Math.max(0, Math.round((end - start) / 60000))
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  return `${hours}h ${mins}m`
}
