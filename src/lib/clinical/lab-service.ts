import { createClient } from "@/lib/supabase/client"

export type LabCase = {
  id: string
  organization_id: string
  branch_id: string
  patient_id: string
  provider_id: string | null
  lab_name: string
  case_type: string
  sent_date: string
  expected_date: string | null
  received_date: string | null
  status: "pending" | "received" | "cancelled"
  cost: number
  notes: string | null
  created_at: string
  updated_at: string
}

export type PatientWithLabCase = LabCase & {
  patients: {
    first_name: string
    last_name: string
    id: string
  }
  next_appointment_date?: string | null
}

export async function fetchActiveLabCases(branchId: string): Promise<{ data: PatientWithLabCase[]; error: string | null }> {
  const supabase = createClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("lab_cases")
    .select(`
      *,
      patients (
        id,
        first_name,
        last_name,
        appointments (
          scheduled_at,
          status
        )
      )
    `)
    .eq("branch_id", branchId)
    .neq("status", "cancelled")
    .order("expected_date", { ascending: true })

  if (error) return { data: [], error: error.message }

  const enriched = (data ?? []).map((item: any) => {
    const upcoming = item.patients?.appointments
      ?.filter((a: any) => a.status === "scheduled" && a.scheduled_at >= now)
      ?.sort((a: any, b: any) => a.scheduled_at.localeCompare(b.scheduled_at))[0]

    return {
      ...item,
      next_appointment_date: upcoming ? upcoming.scheduled_at.slice(0, 10) : null
    }
  })

  return { data: enriched as unknown as PatientWithLabCase[], error: null }
}

export async function fetchPatientLabCases(
  patientId: string,
  branchId?: string | null
): Promise<{ data: PatientWithLabCase[]; error: string | null }> {
  const supabase = createClient()
  let query = supabase
    .from("lab_cases")
    .select(`
      *,
      patients (
        id,
        first_name,
        last_name
      )
    `)
    .eq("patient_id", patientId)
    .neq("status", "cancelled")
    .order("sent_date", { ascending: false })

  if (branchId) query = query.eq("branch_id", branchId)

  const { data, error } = await query
  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as unknown as PatientWithLabCase[], error: null }
}

export async function createLabCase(
  payload: Omit<LabCase, "id" | "created_at" | "updated_at" | "organization_id" | "branch_id" | "status"> & { branch_id: string }
): Promise<{ data: PatientWithLabCase | null; error: string | null }> {
  const supabase = createClient()
  const { data: created, error } = await supabase.rpc("create_lab_case_guarded", {
    p_payload: payload,
  })
  if (error) return { data: null, error: error.message }
  const createdId = (created as { id: string }).id
  const { data } = await supabase
    .from("lab_cases")
    .select("*, patients(id, first_name, last_name)")
    .eq("id", createdId)
    .single()
  return { data: data as unknown as PatientWithLabCase, error: null }
}

export async function updateLabCaseStatus(
  id: string,
  status: "pending" | "received" | "cancelled"
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("update_lab_case_status_guarded", {
    p_case_id: id,
    p_status: status,
  })
  return { error: error?.message ?? null }
}
