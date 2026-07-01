import { createClient } from "@/lib/supabase/client"
import type { PatientFormValues } from "@/lib/validations/patient"
import { getShowcaseSnapshot } from "@/lib/showcase/intercept"
import { seedDefaultConsentsForPatient } from "@/lib/patients/consent-service"
import {
  parsePatientIntakeProfile,
  serializePatientIntakeProfile,
  type PatientIntakeProfile,
} from "@/lib/patients/patient-intake-profile"
import {
  DEFAULT_PATIENT_LIST_FILTERS,
  resolveVisitRange,
  type PatientListFilters,
} from "@/lib/patients/patient-list-filters"
import { fetchPatientProfilePhotoUrls } from "@/lib/patients/patient-documents-service"

export interface PatientRecord {
  id: string
  patient_number?: string | null
  first_name: string
  last_name: string
  date_of_birth: string | null
  gender: string | null
  phone: string | null
  email: string | null
  address: string | null
  status: string
  last_visit_at?: string | null
  intake_pct?: number
  profile_photo_url?: string | null
  branches?: string[]
}

export type PatientSearchOptions = {
  page?: number
  pageSize?: number
  filters?: PatientListFilters
}

export interface PatientWithContacts extends PatientRecord {
  emergency_contact?: { name: string; phone: string | null; relationship?: string | null } | null
  intake_profile?: PatientIntakeProfile
}

function isMissingSearchPatientsRpc(message: string): boolean {
  return (
    message.includes("Could not find the function") ||
    message.includes("PGRST202") ||
    message.includes("schema cache")
  )
}

type SearchPatientsRow = PatientRecord & { total_count?: number }

function mapSearchPatientsRows(rows: SearchPatientsRow[]) {
  const total = rows.length > 0 ? Number(rows[0].total_count ?? rows.length) : 0
  const patients = rows.map(({ total_count: _tc, ...patient }) => patient)
  return { data: patients, total }
}

async function attachPatientBranches(patients: PatientRecord[]): Promise<PatientRecord[]> {
  if (patients.length === 0) return patients
  const supabase = createClient()
  const patientIds = patients.map((p) => p.id)

  const { data, error } = await supabase
    .from("patient_branch_links")
    .select("patient_id, branch:branches(name)")
    .in("patient_id", patientIds)

  if (error || !data) return patients

  const branchMap: Record<string, string[]> = {}
  data.forEach((row: any) => {
    const pId = row.patient_id
    const bName = row.branch?.name
    if (bName) {
      if (!branchMap[pId]) branchMap[pId] = []
      branchMap[pId].push(bName)
    }
  })

  return patients.map((p) => ({
    ...p,
    branches: branchMap[p.id] ?? [],
  }))
}

async function attachProfilePhotoUrls(patients: PatientRecord[]): Promise<PatientRecord[]> {
  if (patients.length === 0) return patients
  const { urls } = await fetchPatientProfilePhotoUrls(patients.map((p) => p.id))
  if (urls.size === 0) return patients
  return patients.map((patient) => ({
    ...patient,
    profile_photo_url: urls.get(patient.id) ?? patient.profile_photo_url ?? null,
  }))
}

export async function searchPatients(
  query: string,
  branchId: string | null,
  options?: PatientSearchOptions
): Promise<{ data: PatientRecord[]; total: number; error: string | null }> {
  const showcase = getShowcaseSnapshot()
  if (showcase && branchId === showcase.branch.id) {
    const page = Math.max(1, options?.page ?? 1)
    const pageSize = Math.min(50, Math.max(1, options?.pageSize ?? 20))
    const offset = (page - 1) * pageSize
    const slice = showcase.patients.slice(offset, offset + pageSize)
    return { data: slice, total: showcase.patients.length, error: null }
  }

  const supabase = createClient()
  const page = Math.max(1, options?.page ?? 1)
  const pageSize = Math.min(50, Math.max(1, options?.pageSize ?? 20))
  const offset = (page - 1) * pageSize
  const filters = options?.filters ?? DEFAULT_PATIENT_LIST_FILTERS
  const visitRange = resolveVisitRange(filters)
  const trimmedQuery = query.trim() || null

  const { data, error } = await supabase.rpc("search_patients", {
    p_query: trimmedQuery,
    p_branch_id: branchId,
    p_limit: pageSize,
    p_offset: offset,
    p_status: filters.status,
    p_last_visit_from: visitRange.from,
    p_last_visit_to: visitRange.to,
    p_never_visited: visitRange.neverVisited,
    p_sort: filters.sort,
  })

  if (!error) {
    const mapped = mapSearchPatientsRows((data ?? []) as SearchPatientsRow[])
    const dataWithPhotos = await attachProfilePhotoUrls(mapped.data)
    const dataWithBranches = await attachPatientBranches(dataWithPhotos)
    return { data: dataWithBranches, total: mapped.total, error: null }
  }

  if (!isMissingSearchPatientsRpc(error.message)) {
    return { data: [], total: 0, error: error.message }
  }

  const legacy = await supabase.rpc("search_patients", {
    p_query: trimmedQuery,
    p_branch_id: branchId,
    p_limit: pageSize,
    p_offset: offset,
  })

  if (legacy.error) {
    return {
      data: [],
      total: 0,
      error: `${error.message} (legacy RPC also failed: ${legacy.error.message})`,
    }
  }

  const mapped = mapSearchPatientsRows((legacy.data ?? []) as SearchPatientsRow[])
  const dataWithPhotos = await attachProfilePhotoUrls(mapped.data)
  const dataWithBranches = await attachPatientBranches(dataWithPhotos)
  return { data: dataWithBranches, total: mapped.total, error: null }
}

function computeIntakePct(patient: {
  id: string
  phone: string | null
  date_of_birth: string | null
}, hasMedical: Set<string>, hasSignedConsent: Set<string>): number {
  return Math.min(
    100,
    (patient.phone ? 25 : 0) +
      (patient.date_of_birth ? 25 : 0) +
      (hasMedical.has(patient.id) ? 25 : 0) +
      (hasSignedConsent.has(patient.id) ? 25 : 0)
  )
}

export async function fetchPatientRecordsByIds(
  patientIds: string[],
  branchId: string | null
): Promise<{ data: PatientRecord[]; error: string | null }> {
  const uniqueIds = [...new Set(patientIds)]
  if (uniqueIds.length === 0) return { data: [], error: null }

  const showcase = getShowcaseSnapshot()
  if (showcase && branchId === showcase.branch.id) {
    const byId = new Map(showcase.patients.map((p) => [p.id, p]))
    return {
      data: uniqueIds
        .map((id) => byId.get(id))
        .filter((patient): patient is PatientRecord => Boolean(patient)),
      error: null,
    }
  }

  if (!branchId) return { data: [], error: null }

  const supabase = createClient()
  const [patientsRes, linksRes, medicalRes, consentsRes] = await Promise.all([
    supabase
      .from("patients")
      .select(
        "id, patient_number, first_name, last_name, date_of_birth, gender, phone, email, address, status"
      )
      .in("id", uniqueIds),
    supabase
      .from("patient_branch_links")
      .select("patient_id, last_visit_at")
      .eq("branch_id", branchId)
      .in("patient_id", uniqueIds),
    supabase.from("patient_medical_histories").select("patient_id").in("patient_id", uniqueIds),
    supabase
      .from("patient_consents")
      .select("patient_id, status")
      .in("patient_id", uniqueIds)
      .eq("status", "signed"),
  ])

  if (patientsRes.error) return { data: [], error: patientsRes.error.message }

  const lastVisitById = new Map(
    (linksRes.data ?? []).map((link) => [link.patient_id, link.last_visit_at])
  )
  const hasMedical = new Set<string>((medicalRes.data ?? []).map((row) => row.patient_id as string))
  const hasSignedConsent = new Set<string>((consentsRes.data ?? []).map((row) => row.patient_id as string))

  const records = (patientsRes.data ?? []).map((patient) => ({
    ...patient,
    last_visit_at: lastVisitById.get(patient.id) ?? null,
    intake_pct: computeIntakePct(patient, hasMedical, hasSignedConsent),
  }))
  const dataWithPhotos = await attachProfilePhotoUrls(records)

  return {
    data: dataWithPhotos,
    error: null,
  }
}

export async function findPatientsByPhone(
  phone: string
): Promise<{ data: Pick<PatientRecord, "id" | "first_name" | "last_name" | "phone">[]; error: string | null }> {
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 7) return { data: [], error: null }

  const supabase = createClient()
  const { data, error } = await supabase
    .from("patients")
    .select("id, first_name, last_name, phone")
    .eq("status", "active")
    .ilike("phone", `%${digits.slice(-7)}%`)
    .limit(5)

  if (error) return { data: [], error: error.message }

  const matches = (data ?? []).filter((p) => {
    const pDigits = (p.phone ?? "").replace(/\D/g, "")
    return pDigits === digits || pDigits.endsWith(digits.slice(-7))
  })

  return { data: matches, error: null }
}

export interface DuplicateCandidate {
  patient_id: string
  first_name: string
  last_name: string
  date_of_birth: string | null
  phone: string | null
  match_reason: string
  score: number
}

export async function detectDuplicatePatients(params: {
  firstName: string
  lastName: string
  dateOfBirth?: string
  phone?: string
}): Promise<{ data: DuplicateCandidate[]; error: string | null }> {
  if (!params.firstName.trim() || !params.lastName.trim()) {
    return { data: [], error: null }
  }

  const supabase = createClient()
  const { data, error } = await supabase.rpc("detect_duplicate_patient", {
    p_first_name: params.firstName.trim(),
    p_last_name: params.lastName.trim(),
    p_date_of_birth: params.dateOfBirth || null,
    p_phone: params.phone || null,
  })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as DuplicateCandidate[], error: null }
}

export async function mergePatients(params: {
  masterId: string
  duplicateId: string
  reason?: string
}): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("merge_patients", {
    p_master_id: params.masterId,
    p_duplicate_id: params.duplicateId,
    p_reason: params.reason ?? null,
  })
  return { error: error?.message ?? null }
}

export async function getPatient(
  patientId: string
): Promise<{ data: PatientWithContacts | null; error: string | null }> {
  const showcase = getShowcaseSnapshot()
  if (showcase) {
    const found = showcase.patients.find((p) => p.id === patientId)
    if (found) {
      return { data: { ...found, emergency_contact: null }, error: null }
    }
  }

  const supabase = createClient()

  const { data: patient, error } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .maybeSingle()

  if (error || !patient) {
    return { data: null, error: error?.message ?? "Patient not found" }
  }

  const { data: contacts } = await supabase
    .from("patient_contacts")
    .select("name, phone, relationship")
    .eq("patient_id", patientId)
    .eq("contact_type", "emergency")
    .limit(1)
    .maybeSingle()

  const row = patient as PatientRecord & { intake_profile?: unknown }

  return {
    data: {
      ...(row as PatientRecord),
      emergency_contact: contacts ?? null,
      intake_profile: parsePatientIntakeProfile(row.intake_profile),
    },
    error: null,
  }
}

export async function finalizePatientIntake(
  form: PatientFormValues,
  branchId: string,
  organizationId: string
): Promise<{ data: { id: string; intakeId: string } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("finalize_patient_intake", {
    p_payload: {
      organization_id: organizationId,
      branch_id: branchId,
      first_name: form.firstName,
      last_name: form.lastName,
      date_of_birth: form.dateOfBirth || null,
      gender: form.gender,
      phone: form.phoneNumber,
      email: form.email || null,
      address_line1: form.addressLine1,
      city: form.city,
      emergency_contact_name: form.emergencyContactName || null,
      emergency_contact_phone: form.emergencyContactPhone || null,
      medical_alerts: form.medicalAlerts || null,
    },
  })

  if (error) return { data: null, error: error.message }

  const raw = data as { patient_id: string; intake_id: string }
  await seedDefaultConsentsForPatient({
    patientId: raw.patient_id,
    organizationId,
    branchId,
  })

  return { data: { id: raw.patient_id, intakeId: raw.intake_id }, error: null }
}

export async function createPatient(
  form: PatientFormValues,
  branchId: string,
  organizationId: string,
  userId: string
): Promise<{ data: { id: string } | null; error: string | null }> {
  const { data, error } = await finalizePatientIntake(form, branchId, organizationId)
  if (error || !data) return { data: null, error: error ?? "Failed to create patient" }
  return { data: { id: data.id }, error: null }
}

export async function updatePatient(
  patientId: string,
  form: PatientFormValues,
  userId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const address = [form.addressLine1, form.city].filter(Boolean).join(", ")

  const { error } = await supabase
    .from("patients")
    .update({
      first_name: form.firstName,
      last_name: form.lastName,
      date_of_birth: form.dateOfBirth || null,
      gender: form.gender,
      phone: form.phoneNumber,
      email: form.email || null,
      address,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", patientId)

  if (error) return { error: error.message }

  if (form.emergencyContactName) {
    const { data: existing } = await supabase
      .from("patient_contacts")
      .select("id")
      .eq("patient_id", patientId)
      .eq("contact_type", "emergency")
      .maybeSingle()

    if (existing) {
      await supabase
        .from("patient_contacts")
        .update({
          name: form.emergencyContactName,
          phone: form.emergencyContactPhone || null,
        })
        .eq("id", existing.id)
    } else {
      await supabase.from("patient_contacts").insert({
        patient_id: patientId,
        contact_type: "emergency",
        name: form.emergencyContactName,
        phone: form.emergencyContactPhone || null,
      })
    }
  }

  return { error: null }
}

export async function updatePatientIntakeProfile(
  patientId: string,
  profile: PatientIntakeProfile,
  userId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("patients")
    .update({
      intake_profile: serializePatientIntakeProfile(profile),
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", patientId)

  if (error) {
    const message = error.message ?? ""
    if (message.includes("intake_profile")) {
      return {
        error:
          "Patient intake profile column is missing. Run supabase/scripts/APPLY_PATIENT_INTAKE_PROFILE.sql, then NOTIFY pgrst, 'reload schema';",
      }
    }
    return { error: message }
  }

  return { error: null }
}

export async function getPatientBranchVisit(
  patientId: string,
  branchId: string
): Promise<{ lastVisitAt: string | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("patient_branch_links")
    .select("last_visit_at")
    .eq("patient_id", patientId)
    .eq("branch_id", branchId)
    .maybeSingle()

  if (error) return { lastVisitAt: null, error: error.message }
  return { lastVisitAt: data?.last_visit_at ?? null, error: null }
}

export function patientToFormValues(patient: PatientWithContacts): PatientFormValues {
  const [addressLine1 = "", city = ""] = (patient.address ?? "").split(", ").concat(["", ""])
  return {
    firstName: patient.first_name,
    lastName: patient.last_name,
    dateOfBirth: patient.date_of_birth ?? "",
    gender: (patient.gender as PatientFormValues["gender"]) ?? "prefer_not_to_say",
    email: patient.email ?? "",
    phoneNumber: patient.phone ?? "",
    addressLine1,
    city: city || addressLine1,
    emergencyContactName: patient.emergency_contact?.name ?? "",
    emergencyContactPhone: patient.emergency_contact?.phone ?? "",
    medicalAlerts: "",
  }
}

export async function updatePatientPhone(
  patientId: string,
  phone: string,
  userId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("patients")
    .update({
      phone: phone.trim() || null,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", patientId)

  if (error) return { error: error.message }
  return { error: null }
}
