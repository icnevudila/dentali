import { createClient } from "@/lib/supabase/client"
import {
  fetchOrthoAdjustments,
  fetchOrthoCase,
  type OrthoAdjustment,
  type OrthoCase,
} from "@/lib/clinical/ortho-service"
import { fetchBranchContext } from "@/lib/org/branch-context-service"

export interface OrthoPrintData {
  case_id: string
  patient_id: string
  patient_name: string
  birth_date?: string
  phone?: string
  branch_name: string
  diagnosis: string | null
  appliance_type: string | null
  start_date: string | null
  contract_amount: number
  notes?: string | null
  visits: Array<{
    visit_date: string
    procedure?: string
    next_procedure?: string
    notes?: string
  }>
}

function formatPatientName(row: {
  first_name?: string | null
  last_name?: string | null
} | null): string {
  if (!row) return "Patient"
  return `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "Patient"
}

function mapVisits(adjustments: OrthoAdjustment[]): OrthoPrintData["visits"] {
  return adjustments.map((row) => ({
    visit_date: row.adjustment_date,
    procedure: row.procedure || undefined,
    next_procedure: row.next_procedure || undefined,
    notes: row.notes || undefined,
  }))
}

function toPrintData(
  caseRow: OrthoCase,
  patient: { first_name?: string | null; last_name?: string | null; date_of_birth?: string | null; phone?: string | null } | null,
  branchName: string,
  adjustments: OrthoAdjustment[]
): OrthoPrintData {
  return {
    case_id: caseRow.id,
    patient_id: caseRow.patient_id,
    patient_name: formatPatientName(patient),
    birth_date: patient?.date_of_birth ?? undefined,
    phone: patient?.phone ?? undefined,
    branch_name: branchName,
    diagnosis: caseRow.diagnosis,
    appliance_type: caseRow.appliance_type,
    start_date: caseRow.start_date,
    contract_amount: Number(caseRow.contract_amount || 0),
    notes: caseRow.notes,
    visits: mapVisits(adjustments),
  }
}

export async function fetchOrthoPrintData(
  patientId: string,
  branchId?: string
): Promise<{ data: OrthoPrintData | null; error: string | null }> {
  const supabase = createClient()

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id, first_name, last_name, date_of_birth, phone")
    .eq("id", patientId)
    .maybeSingle()

  if (patientError) return { data: null, error: patientError.message }

  if (branchId) {
    const [{ data: caseRow, error: caseError }, branchResult] = await Promise.all([
      fetchOrthoCase(patientId, branchId),
      fetchBranchContext(branchId),
    ])
    if (caseError) return { data: null, error: caseError }
    if (!caseRow) return { data: null, error: null }

    const { data: adjustments, error: adjError } = await fetchOrthoAdjustments(caseRow.id)
    if (adjError) return { data: null, error: adjError }

    const branchName = branchResult.data?.branch_name?.trim() || "Clinic"
    return {
      data: toPrintData(caseRow, patient, branchName, adjustments),
      error: null,
    }
  }

  // No active branch in client store — load latest case for patient (still no fabricated data)
  const { data: caseRow, error } = await supabase
    .from("ortho_cases")
    .select(
      "id, patient_id, branch_id, status, appliance_type, start_date, contract_amount, notes, diagnosis, linked_invoice_id, created_at"
    )
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  if (!caseRow) return { data: null, error: null }

  const [{ data: adjustments, error: adjError }, branchResult] = await Promise.all([
    fetchOrthoAdjustments(caseRow.id),
    fetchBranchContext(caseRow.branch_id),
  ])
  if (adjError) return { data: null, error: adjError }

  const branchName = branchResult.data?.branch_name?.trim() || "Clinic"
  return {
    data: toPrintData(caseRow as OrthoCase, patient, branchName, adjustments),
    error: null,
  }
}
