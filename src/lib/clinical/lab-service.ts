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
}

export async function fetchActiveLabCases(branchId: string): Promise<{ data: PatientWithLabCase[] | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("lab_cases")
    .select(`
      *,
      patients:patient_id (
        id,
        first_name,
        last_name
      )
    `)
    .eq("branch_id", branchId)
    .neq("status", "cancelled")
    .order("expected_date", { ascending: true })

  if (error) return { data: null, error: error.message }
  return { data: data as unknown as PatientWithLabCase[], error: null }
}

export async function createLabCase(
  payload: Omit<LabCase, "id" | "created_at" | "updated_at" | "organization_id" | "branch_id" | "status"> & { branch_id: string }
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { data: orgData } = await supabase.from("branches").select("organization_id").eq("id", payload.branch_id).single()
  
  const { error } = await supabase.from("lab_cases").insert({
    ...payload,
    organization_id: orgData?.organization_id,
    status: "pending"
  })

  return { error: error?.message ?? null }
}

export async function updateLabCaseStatus(
  id: string,
  status: "pending" | "received" | "cancelled"
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const updates: any = { status, updated_at: new Date().toISOString() }
  if (status === "received") {
    updates.received_date = new Date().toISOString().split('T')[0]
  }

  const { error } = await supabase.from("lab_cases").update(updates).eq("id", id)
  return { error: error?.message ?? null }
}
