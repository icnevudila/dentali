import { createClient } from "@/lib/supabase/client"

export type StaffMessage = {
  id: string
  body: string
  author_id: string
  author_name?: string
  created_at: string
}

export async function fetchStaffMessages(
  branchId: string,
  limit = 80
): Promise<{ data: StaffMessage[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("staff_messages")
    .select("id, body, author_id, created_at")
    .eq("branch_id", branchId)
    .order("created_at", { ascending: true })
    .limit(limit)

  if (error) return { data: [], error: error.message }

  const rows = data ?? []
  const authorIds = [...new Set(rows.map((row) => row.author_id))]
  const nameMap = new Map<string, string>()

  if (authorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", authorIds)
    for (const profile of profiles ?? []) {
      nameMap.set(profile.id, profile.full_name ?? profile.email ?? "Staff")
    }
  }

  return {
    data: rows.map((row) => ({
      id: row.id,
      body: row.body,
      author_id: row.author_id,
      author_name: nameMap.get(row.author_id) ?? "Staff",
      created_at: row.created_at,
    })),
    error: null,
  }
}

export async function postStaffMessage(params: {
  organizationId: string
  branchId: string
  body: string
}): Promise<{ data: StaffMessage | null; error: string | null }> {
  const trimmed = params.body.trim()
  if (!trimmed) return { data: null, error: "Message cannot be empty" }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: "Not authenticated" }

  const { data, error } = await supabase
    .from("staff_messages")
    .insert({
      organization_id: params.organizationId,
      branch_id: params.branchId,
      author_id: user.id,
      body: trimmed,
    })
    .select("id, body, author_id, created_at")
    .single()

  if (error || !data) return { data: null, error: error?.message ?? "Failed to send message" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle()

  return {
    data: {
      id: data.id,
      body: data.body,
      author_id: data.author_id,
      author_name: profile?.full_name ?? profile?.email ?? "Staff",
      created_at: data.created_at,
    },
    error: null,
  }
}
