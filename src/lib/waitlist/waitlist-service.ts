import { createClient } from "@/lib/supabase/client"

export type WaitlistStatus = "waiting" | "contacted" | "booked" | "cancelled" | "expired"
export type WaitlistUrgency = "normal" | "urgent" | "high"
export type ContactOutcome = "reached" | "no_answer" | "voicemail" | "declined" | "other"

export interface WaitlistEntry {
  id: string
  patient_id: string
  patient_name?: string
  patient_phone?: string | null
  status: WaitlistStatus
  urgency: WaitlistUrgency
  preferred_date: string | null
  preferred_time_start: string | null
  preferred_time_end: string | null
  notes: string | null
  appointment_id: string | null
  expires_at: string | null
  slot_alert_sent_at: string | null
  created_at: string
}

export interface ContactAttempt {
  id: string
  note: string | null
  outcome: ContactOutcome
  created_at: string
  created_by_name?: string
}

export async function fetchWaitlistEntries(
  branchId: string,
  statusFilter?: WaitlistStatus | "active" | "history"
): Promise<{ data: WaitlistEntry[]; error: string | null }> {
  const supabase = createClient()

  let query = supabase
    .from("waitlist_entries")
    .select(
      "id, patient_id, status, urgency, preferred_date, preferred_time_start, preferred_time_end, notes, appointment_id, expires_at, slot_alert_sent_at, created_at, patients(first_name, last_name, phone)"
    )
    .eq("branch_id", branchId)
    .order("urgency", { ascending: false })
    .order("created_at", { ascending: true })

  if (statusFilter === "active") {
    query = query.in("status", ["waiting", "contacted"])
  } else if (statusFilter === "history") {
    query = query.in("status", ["booked", "cancelled", "expired"])
  } else if (statusFilter) {
    query = query.eq("status", statusFilter)
  } else {
    query = query.in("status", ["waiting", "contacted"])
  }

  const { data, error } = await query

  if (error) return { data: [], error: error.message }

  const mapped = (data ?? []).map((row) => {
    const p = row.patients as
      | { first_name: string; last_name: string; phone: string | null }
      | { first_name: string; last_name: string; phone: string | null }[]
      | null
    const patient = Array.isArray(p) ? p[0] : p
    return {
      id: row.id,
      patient_id: row.patient_id,
      patient_name: patient ? `${patient.first_name} ${patient.last_name}` : undefined,
      patient_phone: patient?.phone ?? null,
      status: row.status as WaitlistStatus,
      urgency: row.urgency as WaitlistUrgency,
      preferred_date: row.preferred_date,
      preferred_time_start: row.preferred_time_start,
      preferred_time_end: row.preferred_time_end,
      notes: row.notes,
      appointment_id: row.appointment_id,
      expires_at: row.expires_at,
      slot_alert_sent_at: row.slot_alert_sent_at ?? null,
      created_at: row.created_at,
    }
  })

  return { data: mapped, error: null }
}

export async function createWaitlistEntry(params: {
  organizationId: string
  branchId: string
  patientId: string
  urgency: WaitlistUrgency
  preferredDate?: string
  preferredTimeStart?: string
  preferredTimeEnd?: string
  notes?: string
  expiresAt?: string
  userId: string
}): Promise<{ data: { id: string } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("create_waitlist_entry", {
    p_payload: {
      organization_id: params.organizationId,
      branch_id: params.branchId,
      patient_id: params.patientId,
      urgency: params.urgency,
      preferred_date: params.preferredDate ?? null,
      preferred_time_start: params.preferredTimeStart ?? null,
      preferred_time_end: params.preferredTimeEnd ?? null,
      notes: params.notes ?? null,
      expires_at: params.expiresAt ?? null,
    },
  })

  if (error) return { data: null, error: error.message }
  const raw = data as { id: string }
  return { data: { id: raw.id }, error: null }
}

export async function markWaitlistContacted(
  entryId: string,
  note: string,
  outcome: ContactOutcome
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("mark_waitlist_contacted", {
    p_entry_id: entryId,
    p_note: note || null,
    p_outcome: outcome,
  })
  return { error: error?.message ?? null }
}

export async function bookFromWaitlist(
  entryId: string,
  scheduledAt: string,
  purpose?: string
): Promise<{ data: { appointment_id: string } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("book_waitlist_entry", {
    p_entry_id: entryId,
    p_scheduled_at: scheduledAt,
    p_purpose: purpose || null,
  })

  if (error) return { data: null, error: error.message }
  const result = data as { appointment_id: string } | null
  return { data: result ? { appointment_id: result.appointment_id } : null, error: null }
}

export async function cancelWaitlistEntry(entryId: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("cancel_waitlist_entry", {
    p_entry_id: entryId,
  })
  return { error: error?.message ?? null }
}

export async function fetchContactAttempts(
  entryId: string
): Promise<{ data: ContactAttempt[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("waitlist_contact_attempts")
    .select("id, note, outcome, created_at, profiles(full_name)")
    .eq("waitlist_entry_id", entryId)
    .order("created_at", { ascending: false })

  if (error) return { data: [], error: error.message }

  const mapped = (data ?? []).map((row) => {
    const profile = row.profiles as { full_name: string } | { full_name: string }[] | null
    const p = Array.isArray(profile) ? profile[0] : profile
    return {
      id: row.id,
      note: row.note,
      outcome: row.outcome as ContactOutcome,
      created_at: row.created_at,
      created_by_name: p?.full_name,
    }
  })

  return { data: mapped, error: null }
}

export interface WaitlistSlotNotifyResult {
  notified: number
  skipped: number
  dry_run: boolean
  results: Array<{
    entry_id: string
    patient_id: string
    status: string
    log_id?: string
    error?: string
  }>
}

export async function notifyWaitlistOnSlotOpen(params: {
  branchId: string
  slotAt: string
  limit?: number
}): Promise<{ data: WaitlistSlotNotifyResult | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.functions.invoke("notify-waitlist-slot", {
    body: {
      branch_id: params.branchId,
      slot_at: params.slotAt,
      limit: params.limit ?? 3,
    },
  })

  if (error) {
    if (error.message.includes("Failed to send a request to the Edge Function")) {
      return { data: null, error: null }
    }
    return { data: null, error: error.message }
  }
  if (data?.error) return { data: null, error: String(data.error) }
  return {
    data: {
      notified: Number(data.notified ?? 0),
      skipped: Number(data.skipped ?? 0),
      dry_run: Boolean(data.dry_run),
      results: (data.results ?? []) as WaitlistSlotNotifyResult["results"],
    },
    error: null,
  }
}
