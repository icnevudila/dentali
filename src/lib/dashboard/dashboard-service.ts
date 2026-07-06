import { createClient } from "@/lib/supabase/client"
import { getShowcaseSnapshot } from "@/lib/showcase/intercept"

export interface DashboardStats {
  active_patients: number
  today_appointments: number
  pending_consents: number
  queue_waiting: number
  waitlist_waiting: number
  open_invoices: number
  overdue_invoices: number
  today_collected: number
  low_stock_items: number
  missing_clinical_notes: number
  hmo_draft_claims: number
  philhealth_pending: number
  pending_intake_drafts: number
  appointments_awaiting_checkin: number
  open_encounters_stale: number
  hmo_pending_claims: number
}

export async function fetchDashboardStats(
  branchId: string | null
): Promise<{ data: DashboardStats | null; error: string | null }> {
  const showcase = getShowcaseSnapshot()
  if (showcase && branchId === showcase.branch.id) {
    return { data: showcase.stats, error: null }
  }

  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_dashboard_stats", {
    p_branch_id: branchId,
  })

  if (error) return { data: null, error: error.message }

  const raw = data as Record<string, number>
  return {
    data: {
      active_patients: Number(raw.active_patients ?? 0),
      today_appointments: Number(raw.today_appointments ?? 0),
      pending_consents: Number(raw.pending_consents ?? 0),
      queue_waiting: Number(raw.queue_waiting ?? 0),
      waitlist_waiting: Number(raw.waitlist_waiting ?? 0),
      open_invoices: Number(raw.open_invoices ?? 0),
      overdue_invoices: Number(raw.overdue_invoices ?? 0),
      today_collected: Number(raw.today_collected ?? 0),
      low_stock_items: Number(raw.low_stock_items ?? 0),
      missing_clinical_notes: Number(raw.missing_clinical_notes ?? 0),
      hmo_draft_claims: Number(raw.hmo_draft_claims ?? 0),
      philhealth_pending: Number(raw.philhealth_pending ?? 0),
      pending_intake_drafts: Number(raw.pending_intake_drafts ?? 0),
      appointments_awaiting_checkin: Number(raw.appointments_awaiting_checkin ?? 0),
      open_encounters_stale: Number(raw.open_encounters_stale ?? 0),
      hmo_pending_claims: Number(raw.hmo_pending_claims ?? 0),
    },
    error: null,
  }
}
