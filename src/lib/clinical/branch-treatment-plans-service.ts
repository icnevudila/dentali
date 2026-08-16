import { createClient } from "@/lib/supabase/client"

export type TreatmentPlanStatusGroup = "all" | "unapproved" | "approved" | "ongoing" | "history"

export interface BranchTreatmentPlanRow {
  plan_id: string
  patient_id: string
  first_name: string
  last_name: string
  title: string
  status: string
  status_group: TreatmentPlanStatusGroup
  total_estimated: number
  created_at: string
  approved_at: string | null
  item_count: number
  items_planned: number
  items_in_progress: number
  items_completed: number
}

export interface BranchTreatmentPlanCounts {
  all: number
  unapproved: number
  approved: number
  ongoing: number
  history: number
}

export interface BranchTreatmentPlanList {
  status_group: TreatmentPlanStatusGroup
  counts: BranchTreatmentPlanCounts
  rows: BranchTreatmentPlanRow[]
}

const EMPTY_COUNTS: BranchTreatmentPlanCounts = {
  all: 0,
  unapproved: 0,
  approved: 0,
  ongoing: 0,
  history: 0,
}

export function treatmentPlanPatientName(row: Pick<BranchTreatmentPlanRow, "first_name" | "last_name">) {
  return `${row.last_name}, ${row.first_name}`.replace(/^,\s*/, "").trim()
}

export async function fetchBranchTreatmentPlans(
  branchId: string,
  statusGroup: TreatmentPlanStatusGroup = "all"
): Promise<{ data: BranchTreatmentPlanList | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("list_branch_treatment_plans", {
    p_branch_id: branchId,
    p_status_group: statusGroup,
    p_limit: 100,
  })
  if (error) return { data: null, error: error.message }
  const raw = (data ?? {}) as Record<string, unknown>
  const countsRaw = (raw.counts ?? {}) as Record<string, unknown>
  const rows = Array.isArray(raw.rows) ? (raw.rows as BranchTreatmentPlanRow[]) : []
  return {
    data: {
      status_group: (raw.status_group as TreatmentPlanStatusGroup) ?? statusGroup,
      counts: {
        all: Number(countsRaw.all ?? 0),
        unapproved: Number(countsRaw.unapproved ?? 0),
        approved: Number(countsRaw.approved ?? 0),
        ongoing: Number(countsRaw.ongoing ?? 0),
        history: Number(countsRaw.history ?? 0),
      },
      rows,
    },
    error: null,
  }
}

export function emptyBranchTreatmentPlanList(
  statusGroup: TreatmentPlanStatusGroup = "all"
): BranchTreatmentPlanList {
  return { status_group: statusGroup, counts: EMPTY_COUNTS, rows: [] }
}
