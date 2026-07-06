import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { AppointmentRecord } from "@/lib/appointments/appointment-service"
import { addDays, startOfWeekMonday, toDateKey } from "@/lib/appointments/week-calendar"
import type { ShowcaseSnapshot, ShowcaseBranch } from "@/lib/showcase/types"
import type { DashboardStats } from "@/lib/dashboard/dashboard-service"
import type { PatientRecord } from "@/lib/patients/patient-service"
import type { QueueEntry } from "@/lib/queue/queue-service"
import type { InvoiceRecord } from "@/lib/billing/invoice-service"
import type { ToothFinding } from "@/lib/types/dental"

const EMPTY_STATS: DashboardStats = {
  active_patients: 0,
  today_appointments: 0,
  pending_consents: 0,
  queue_waiting: 0,
  waitlist_waiting: 0,
  open_invoices: 0,
  overdue_invoices: 0,
  today_collected: 0,
  low_stock_items: 0,
  missing_clinical_notes: 0,
  hmo_draft_claims: 0,
  philhealth_pending: 0,
  pending_intake_drafts: 0,
  appointments_awaiting_checkin: 0,
  open_encounters_stale: 0,
  hmo_pending_claims: 0,
}

async function resolveBranch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  preferredBranchId?: string | null
): Promise<ShowcaseBranch | null> {
  if (preferredBranchId) {
    const { data } = await supabase
      .from("branches")
      .select("id, name, organization_id")
      .eq("id", preferredBranchId)
      .maybeSingle()
    if (data) return data as ShowcaseBranch
  }

  const { data: branches, error: branchError } = await supabase.rpc("get_my_branches")
  if (!branchError && branches?.length) {
    const list = branches as ShowcaseBranch[]
    if (preferredBranchId) {
      const match = list.find((b) => b.id === preferredBranchId)
      if (match) return match
    }
    return list[0]
  }

  const { data: fallback } = await supabase
    .from("branches")
    .select("id, name, organization_id")
    .limit(1)
    .maybeSingle()

  return (fallback as ShowcaseBranch | null) ?? null
}

function mapDashboardStats(raw: Record<string, number>): DashboardStats {
  return {
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
  }
}

async function loadStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  branchId: string
): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc("get_dashboard_stats", {
    p_branch_id: branchId,
  })
  if (error || !data) return EMPTY_STATS
  return mapDashboardStats(data as Record<string, number>)
}

/** Service-role path — get_dashboard_stats needs auth.org context */
async function loadStatsDirect(
  supabase: SupabaseClient,
  branchId: string,
  orgId: string
): Promise<DashboardStats> {
  const manilaToday = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" })
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoManila = weekAgo.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" })

  const [
    patientsRes,
    apptsRes,
    consentsRes,
    queueRes,
    waitlistRes,
    openInvRes,
    overdueRes,
    paymentsRes,
    hmoRes,
    phRes,
    staleEncountersRes,
    hmoPendingRes,
  ] = await Promise.all([
    supabase.from("patients").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "active"),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .in("status", ["scheduled", "confirmed", "checked_in"])
      .gte("scheduled_at", `${manilaToday}T00:00:00+08:00`)
      .lt("scheduled_at", `${manilaToday}T23:59:59+08:00`),
    supabase
      .from("patient_consents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .eq("status", "pending"),
    supabase
      .from("queue_entries")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .in("status", ["waiting", "ready"]),
    supabase
      .from("waitlist_entries")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .in("status", ["waiting", "contacted"]),
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .in("status", ["draft", "sent", "partial"]),
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .in("status", ["sent", "partial"])
      .lt("due_date", manilaToday),
    supabase
      .from("invoice_payments")
      .select("amount, invoices!inner(branch_id, organization_id)")
      .eq("organization_id", orgId)
      .gte("created_at", `${manilaToday}T00:00:00Z`),
    supabase
      .from("hmo_claims")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .eq("status", "draft"),
    supabase
      .from("philhealth_claims")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .in("status", ["draft", "checklist_incomplete", "ready", "sync_failed"]),
    supabase
      .from("patient_encounters")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .eq("status", "open")
      .lt("opened_at", `${manilaToday}T00:00:00+08:00`),
    supabase
      .from("hmo_claims")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .in("status", ["submitted", "under_review"]),
  ])

  let todayCollected = 0
  if (paymentsRes.data) {
    for (const row of paymentsRes.data as Array<{ amount: number; invoices: { branch_id: string } | { branch_id: string }[] }>) {
      const inv = Array.isArray(row.invoices) ? row.invoices[0] : row.invoices
      if (inv?.branch_id === branchId) todayCollected += Number(row.amount)
    }
  }

  const { data: completedAppts } = await supabase
    .from("appointments")
    .select("id, patient_id, scheduled_at")
    .eq("organization_id", orgId)
    .eq("branch_id", branchId)
    .eq("status", "completed")
    .gte("scheduled_at", `${weekAgoManila}T00:00:00+08:00`)

  let missingNotes = 0
  if (completedAppts?.length) {
    for (const appt of completedAppts) {
      const apptDate = new Date(appt.scheduled_at).toLocaleDateString("en-CA", {
        timeZone: "Asia/Manila",
      })
      const { count } = await supabase
        .from("clinical_notes")
        .select("id", { count: "exact", head: true })
        .eq("patient_id", appt.patient_id)
        .eq("branch_id", branchId)
        .eq("status", "signed")
        .or(`appointment_id.eq.${appt.id},signed_at.gte.${apptDate}T00:00:00Z`)
      if (!count) missingNotes += 1
    }
  }

  const { data: lowStockItems } = await supabase
    .from("inventory_items")
    .select("quantity_on_hand, min_stock_level")
    .eq("organization_id", orgId)
    .eq("branch_id", branchId)
    .eq("is_active", true)

  const lowStock =
    lowStockItems?.filter((i) => Number(i.quantity_on_hand) <= Number(i.min_stock_level)).length ?? 0

  const [intakeDraftsRes, awaitingCheckinRes] = await Promise.all([
    supabase
      .from("patient_intakes")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .eq("status", "draft"),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .in("status", ["scheduled", "confirmed"])
      .gte("scheduled_at", `${manilaToday}T00:00:00+08:00`)
      .lt("scheduled_at", `${manilaToday}T23:59:59+08:00`),
  ])

  return mapDashboardStats({
    active_patients: patientsRes.count ?? 0,
    today_appointments: apptsRes.count ?? 0,
    pending_consents: consentsRes.count ?? 0,
    queue_waiting: queueRes.count ?? 0,
    waitlist_waiting: waitlistRes.count ?? 0,
    open_invoices: openInvRes.count ?? 0,
    overdue_invoices: overdueRes.count ?? 0,
    today_collected: todayCollected,
    low_stock_items: lowStock,
    missing_clinical_notes: missingNotes,
    hmo_draft_claims: hmoRes.count ?? 0,
    philhealth_pending: phRes.count ?? 0,
    pending_intake_drafts: intakeDraftsRes.count ?? 0,
    appointments_awaiting_checkin: awaitingCheckinRes.count ?? 0,
    open_encounters_stale: staleEncountersRes.count ?? 0,
    hmo_pending_claims: hmoPendingRes.count ?? 0,
  })
}

async function loadPatients(
  supabase: Awaited<ReturnType<typeof createClient>>,
  branchId: string,
  orgId?: string
): Promise<PatientRecord[]> {
  const { data, error } = await supabase.rpc("search_patients", {
    p_query: null,
    p_branch_id: branchId,
    p_limit: 5,
    p_offset: 0,
    p_status: "all",
    p_last_visit_from: null,
    p_last_visit_to: null,
    p_never_visited: false,
    p_sort: "name",
  })

  if (error || !data) {
    let query = supabase
      .from("patients")
      .select("id, patient_number, first_name, last_name, date_of_birth, gender, phone, email, address, status")
      .eq("status", "active")
      .order("last_name")
      .limit(5)
    if (orgId) query = query.eq("organization_id", orgId)
    const { data: rows } = await query
    return (rows ?? []) as PatientRecord[]
  }

  return (data as Array<PatientRecord & { total_count?: number }>).map(
    ({ total_count: _tc, ...patient }) => patient
  )
}

async function loadChartFindings(
  supabase: Awaited<ReturnType<typeof createClient>>,
  patientId: string,
  branchId: string
): Promise<ToothFinding[]> {
  const { data } = await supabase.rpc("get_patient_odontogram", {
    p_patient_id: patientId,
    p_branch_id: branchId,
  })
  const payload = data as { findings?: ToothFinding[] } | null
  if (payload?.findings?.length) return payload.findings as ToothFinding[]

  const { data: chart } = await supabase
    .from("dental_charts")
    .select("id")
    .eq("patient_id", patientId)
    .eq("branch_id", branchId)
    .eq("status", "active")
    .maybeSingle()

  if (!chart?.id) return []

  const { data: rows } = await supabase
    .from("tooth_findings")
    .select(
      "id, tooth_number, dentition_type, condition, surfaces, restoration_type, surgery_type, notes, status"
    )
    .eq("chart_id", chart.id)
    .eq("status", "active")

  return (rows ?? []).map((row) => ({
    ...row,
    surfaces: (row.surfaces ?? []) as ToothFinding["surfaces"],
  })) as ToothFinding[]
}

async function loadQueue(
  supabase: Awaited<ReturnType<typeof createClient>>,
  branchId: string
): Promise<QueueEntry[]> {
  const { data, error } = await supabase
    .from("queue_entries")
    .select(
      "id, patient_id, appointment_id, display_code, status, chair_label, notes, checked_in_at, called_at, completed_at, patients(first_name, last_name)"
    )
    .eq("branch_id", branchId)
    .in("status", ["waiting", "ready", "now_serving", "in_chair"])
    .order("checked_in_at", { ascending: true })
    .limit(8)

  if (error || !data) return []

  return data.map((row) => {
    const p = row.patients as
      | { first_name: string; last_name: string }
      | { first_name: string; last_name: string }[]
      | null
    const patient = Array.isArray(p) ? p[0] : p
    return {
      id: row.id,
      patient_id: row.patient_id,
      appointment_id: row.appointment_id,
      display_code: row.display_code,
      status: row.status,
      chair_label: row.chair_label,
      notes: row.notes,
      checked_in_at: row.checked_in_at,
      called_at: row.called_at,
      completed_at: row.completed_at,
      patient_name: patient ? `${patient.first_name} ${patient.last_name}` : undefined,
    } as QueueEntry
  })
}

async function loadAppointments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  branchId: string,
  orgId?: string
): Promise<AppointmentRecord[]> {
  const weekStart = startOfWeekMonday(new Date())
  const startKey = toDateKey(weekStart)
  const endKey = toDateKey(addDays(weekStart, 6))

  let query = supabase
    .from("appointments")
    .select("id, scheduled_at, purpose, status, patient_id, patients(first_name, last_name)")
    .eq("branch_id", branchId)
    .gte("scheduled_at", `${startKey}T00:00:00+08:00`)
    .lte("scheduled_at", `${endKey}T23:59:59+08:00`)
    .order("scheduled_at", { ascending: true })

  if (orgId) {
    query = query.eq("organization_id", orgId)
  }

  const { data, error } = await query
  if (error || !data) return []

  return data.map((row) => {
    const p = row.patients as
      | { first_name: string; last_name: string }
      | { first_name: string; last_name: string }[]
      | null
    const patient = Array.isArray(p) ? p[0] : p
    return {
      id: row.id,
      scheduled_at: row.scheduled_at,
      purpose: row.purpose,
      status: row.status,
      patient_id: row.patient_id,
      patient_name: patient ? `${patient.first_name} ${patient.last_name}` : undefined,
    }
  })
}

async function loadInvoices(
  supabase: Awaited<ReturnType<typeof createClient>>,
  branchId: string
): Promise<InvoiceRecord[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, total_amount, paid_amount, status, patient_id, created_at, patients(first_name, last_name)"
    )
    .eq("branch_id", branchId)
    .order("created_at", { ascending: false })
    .limit(6)

  if (error || !data) return []

  return data.map((row) => {
    const p = row.patients as
      | { first_name: string; last_name: string }
      | { first_name: string; last_name: string }[]
      | null
    const patient = Array.isArray(p) ? p[0] : p
    return {
      id: row.id,
      invoice_number: row.invoice_number,
      total_amount: Number(row.total_amount),
      paid_amount: Number(row.paid_amount),
      status: row.status,
      patient_id: row.patient_id,
      created_at: row.created_at,
      patient_name: patient ? `${patient.first_name} ${patient.last_name}` : undefined,
    }
  })
}

async function buildSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  branch: ShowcaseBranch,
  source: ShowcaseSnapshot["source"]
): Promise<ShowcaseSnapshot> {
  const statsPromise =
    source === "service_role"
      ? loadStatsDirect(supabase as SupabaseClient, branch.id, branch.organization_id)
      : loadStats(supabase, branch.id)

  const orgId = source === "service_role" ? branch.organization_id : undefined

  const [stats, patients, queueEntries, invoices, appointments] = await Promise.all([
    statsPromise,
    loadPatients(supabase, branch.id, orgId),
    loadQueue(supabase, branch.id),
    loadInvoices(supabase, branch.id),
    loadAppointments(supabase, branch.id, orgId),
  ])

  const chartPatientId = patients[0]?.id ?? null
  const chartFindings = chartPatientId
    ? await loadChartFindings(supabase, chartPatientId, branch.id)
    : []

  return {
    branch,
    stats,
    patients,
    chartPatientId,
    chartFindings,
    queueEntries,
    invoices,
    appointments,
    readOnly: true,
    source,
  }
}

function emptySnapshot(branchName = "Your clinic"): ShowcaseSnapshot {
  return {
    branch: {
      id: "00000000-0000-0000-0000-000000000000",
      name: branchName,
      organization_id: "00000000-0000-0000-0000-000000000000",
    },
    stats: EMPTY_STATS,
    patients: [],
    chartPatientId: null,
    chartFindings: [],
    queueEntries: [],
    invoices: [],
    appointments: [],
    readOnly: true,
    source: "empty",
  }
}

/** Loads live clinic data for landing/showcase — session first, then service role. */
export async function loadShowcaseData(): Promise<ShowcaseSnapshot> {
  const preferredBranchId = process.env.LANDING_SHOWCASE_BRANCH_ID?.trim() || null

  try {
    const sessionClient = await createClient()
    const {
      data: { user },
    } = await sessionClient.auth.getUser()

    if (user) {
      const branch = await resolveBranch(sessionClient, preferredBranchId)
      if (branch) {
        return buildSnapshot(sessionClient, branch, "session")
      }
    }
  } catch {
    // fall through to service role
  }

  const admin = createAdminClient()
  if (admin) {
    try {
      let branch: ShowcaseBranch | null = null
      if (preferredBranchId) {
        const { data } = await admin
          .from("branches")
          .select("id, name, organization_id")
          .eq("id", preferredBranchId)
          .maybeSingle()
        branch = (data as ShowcaseBranch | null) ?? null
      }
      if (!branch) {
        const { data } = await admin
          .from("branches")
          .select("id, name, organization_id")
          .limit(1)
          .maybeSingle()
        branch = (data as ShowcaseBranch | null) ?? null
      }
      if (branch) {
        return buildSnapshot(admin as unknown as Awaited<ReturnType<typeof createClient>>, branch, "service_role")
      }
    } catch {
      // fall through
    }
  }

  return emptySnapshot()
}
