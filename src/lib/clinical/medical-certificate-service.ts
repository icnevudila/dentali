import { createClient } from "@/lib/supabase/client"

export interface MedicalCertificateRecord {
  id: string
  patient_id: string
  branch_id: string
  doctor_id: string | null
  doctor_name?: string
  diagnosis: string
  rest_days: number
  start_date: string
  end_date: string
  notes: string | null
  protocol_no: string
  status: "draft" | "issued" | "revoked"
  created_at: string
}

const LOCAL_STORAGE_KEY = "dentali_medical_certificates_v1"

function getLocalCertificates(patientId: string): MedicalCertificateRecord[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as MedicalCertificateRecord[]
    return parsed.filter((cert) => cert.patient_id === patientId)
  } catch {
    return []
  }
}

function saveLocalCertificate(cert: MedicalCertificateRecord) {
  if (typeof window === "undefined") return
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    const list = raw ? (JSON.parse(raw) as MedicalCertificateRecord[]) : []
    const idx = list.findIndex((item) => item.id === cert.id)
    if (idx >= 0) {
      list[idx] = cert
    } else {
      list.unshift(cert)
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list))
  } catch {
    // Ignore storage errors
  }
}

export async function fetchPatientCertificates(
  patientId: string,
  branchId: string
): Promise<{ data: MedicalCertificateRecord[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("medical_certificates")
    .select("id, patient_id, branch_id, doctor_id, diagnosis, rest_days, start_date, end_date, notes, protocol_no, status, created_at, profiles:doctor_id(full_name)")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })

  if (error) {
    // Fallback to local storage if table doesn't exist yet
    const local = getLocalCertificates(patientId)
    return { data: local, error: null }
  }

  const list: MedicalCertificateRecord[] = (data ?? []).map((row) => {
    const p = row.profiles as { full_name: string } | { full_name: string }[] | null
    const profile = Array.isArray(p) ? p[0] : p
    return {
      id: row.id,
      patient_id: row.patient_id,
      branch_id: row.branch_id,
      doctor_id: row.doctor_id,
      doctor_name: profile?.full_name ?? "Dr. Dt.",
      diagnosis: row.diagnosis,
      rest_days: row.rest_days,
      start_date: row.start_date,
      end_date: row.end_date,
      notes: row.notes,
      protocol_no: row.protocol_no,
      status: row.status as MedicalCertificateRecord["status"],
      created_at: row.created_at,
    }
  })

  const local = getLocalCertificates(patientId)
  const combinedMap = new Map<string, MedicalCertificateRecord>()
  list.forEach((item) => combinedMap.set(item.id, item))
  local.forEach((item) => {
    if (!combinedMap.has(item.id)) combinedMap.set(item.id, item)
  })

  return { data: Array.from(combinedMap.values()), error: null }
}

export async function createMedicalCertificate(params: {
  patientId: string
  branchId: string
  diagnosis: string
  restDays: number
  startDate: string
  notes?: string
  doctorName?: string
}): Promise<{ data: MedicalCertificateRecord | null; error: string | null }> {
  const supabase = createClient()
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData?.user?.id ?? null

  const startDateObj = new Date(params.startDate)
  const endDateObj = new Date(startDateObj)
  endDateObj.setDate(endDateObj.getDate() + Math.max(0, params.restDays - 1))
  const endDateStr = endDateObj.toISOString().split("T")[0]

  const protocolNo = `RP-${Date.now().toString().slice(-6)}`

  const newRecord: MedicalCertificateRecord = {
    id: `cert_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    patient_id: params.patientId,
    branch_id: params.branchId,
    doctor_id: userId,
    doctor_name: params.doctorName ?? "Dt. Dr.",
    diagnosis: params.diagnosis,
    rest_days: params.restDays,
    start_date: params.startDate,
    end_date: endDateStr,
    notes: params.notes ?? null,
    protocol_no: protocolNo,
    status: "issued",
    created_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("medical_certificates")
    .insert({
      id: newRecord.id,
      patient_id: newRecord.patient_id,
      branch_id: newRecord.branch_id,
      doctor_id: newRecord.doctor_id,
      diagnosis: newRecord.diagnosis,
      rest_days: newRecord.rest_days,
      start_date: newRecord.start_date,
      end_date: newRecord.end_date,
      notes: newRecord.notes,
      protocol_no: newRecord.protocol_no,
      status: newRecord.status,
    })
    .select()
    .single()

  if (error) {
    saveLocalCertificate(newRecord)
    return { data: newRecord, error: null }
  }

  saveLocalCertificate(newRecord)
  return { data: newRecord, error: null }
}

/** Revoke an issued rest certificate (DB + local fallback). */
export async function revokeMedicalCertificate(
  certificateId: string,
  reason?: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const revokedNotePrefix = reason ? `REVOKED: ${reason}` : "REVOKED"

  const { data: existing } = await supabase
    .from("medical_certificates")
    .select("id, notes, status")
    .eq("id", certificateId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from("medical_certificates")
      .update({
        status: "revoked",
        notes: existing.notes
          ? `${revokedNotePrefix} | ${existing.notes}`
          : revokedNotePrefix,
      })
      .eq("id", certificateId)

    if (error) return { error: error.message }
  }

  try {
    const { createClient: sb } = await import("@/lib/supabase/client")
    const client = sb()
    const { data: certRow } = await client
      .from("medical_certificates")
      .select("branch_id, patient_id")
      .eq("id", certificateId)
      .maybeSingle()
    if (certRow?.branch_id) {
      const { data: branch } = await client
        .from("branches")
        .select("organization_id")
        .eq("id", certRow.branch_id)
        .maybeSingle()
      if (branch?.organization_id) {
        const { logAuditEvent } = await import("@/lib/audit/audit-service")
        await logAuditEvent({
          organizationId: branch.organization_id,
          branchId: certRow.branch_id,
          action: "medical_certificate.revoke",
          entityType: "medical_certificate",
          entityId: certificateId,
          metadata: { reason: reason ?? null, patient_id: certRow.patient_id },
        })
      }
    }
  } catch {
    // non-blocking
  }

  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
      const list = raw ? (JSON.parse(raw) as MedicalCertificateRecord[]) : []
      const idx = list.findIndex((item) => item.id === certificateId)
      if (idx >= 0) {
        list[idx] = {
          ...list[idx],
          status: "revoked",
          notes: list[idx].notes
            ? `${revokedNotePrefix} | ${list[idx].notes}`
            : revokedNotePrefix,
        }
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list))
        return { error: null }
      }
    } catch {
      // ignore storage errors
    }
  }

  if (!existing) {
    return { error: "Certificate not found" }
  }

  return { error: null }
}
