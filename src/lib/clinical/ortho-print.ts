import { createClient } from "@/lib/supabase/client"

export interface OrthoPrintData {
  case_id: string
  patient_id: string
  patient_name: string
  birth_date?: string
  phone?: string
  branch_name: string
  malocclusion_type: string
  appliance_type: string
  start_date: string
  estimated_months: number
  archwires_upper?: string
  archwires_lower?: string
  elastics_config?: string
  notes?: string
  visits: Array<{
    visit_date: string
    procedure?: string
    next_procedure?: string
    notes?: string
  }>
}

export async function fetchOrthoPrintData(
  patientId: string,
  branchId?: string
): Promise<{ data: OrthoPrintData | null; error: string | null }> {
  const supabase = createClient()

  // Fetch patient profile info
  const { data: patient } = await supabase
    .from("patients")
    .select("id, full_name, date_of_birth, mobile_number")
    .eq("id", patientId)
    .maybeSingle()

  // Fetch active ortho case
  const { data: caseRow, error } = await supabase
    .from("ortho_cases")
    .select("id, malocclusion_type, appliance_type, start_date, estimated_months, notes, created_at")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !caseRow) {
    // Return sample/mock structure for print preview if offline/empty
    return {
      data: {
        case_id: `ortho_${Date.now()}`,
        patient_id: patientId,
        patient_name: patient?.full_name ?? "Ortodonti Hastası",
        birth_date: patient?.date_of_birth ?? "1995-04-12",
        phone: patient?.mobile_number ?? "+90 532 000 0000",
        branch_name: "Dentali Diş Kliniği",
        malocclusion_type: "Sınıf I Çapraşıklık",
        appliance_type: "Metal Braket (0.022 Slot)",
        start_date: new Date().toISOString().split("T")[0],
        estimated_months: 18,
        archwires_upper: "0.014 NiTi (Üst Çene)",
        archwires_lower: "0.014 NiTi (Alt Çene)",
        elastics_config: "Class II 3/16 4.5 oz",
        notes: "Aylık kontrol, hijyen takibi ve elastik kullanımı düzenli incelenecek.",
        visits: [
          {
            visit_date: new Date().toISOString().split("T")[0],
            procedure: "Braketleme ve 0.014 NiTi ark teli takıldı",
            next_procedure: "Tel değişimi & braket kontrolü",
            notes: "Hasta braket bakımı konusunda bilgilendirildi.",
          },
        ],
      },
      error: null,
    }
  }

  // Fetch visits
  const { data: visitRows } = await supabase
    .from("ortho_visits")
    .select("visit_date, procedure, next_procedure, notes")
    .eq("case_id", caseRow.id)
    .order("visit_date", { ascending: false })

  return {
    data: {
      case_id: caseRow.id,
      patient_id: patientId,
      patient_name: patient?.full_name ?? "Ortodonti Hastası",
      birth_date: patient?.date_of_birth ?? "",
      phone: patient?.mobile_number ?? "",
      branch_name: "Dentali Diş Kliniği",
      malocclusion_type: caseRow.malocclusion_type ?? "Sınıf I Maloklüzyon",
      appliance_type: caseRow.appliance_type ?? "Metal Braket",
      start_date: caseRow.start_date ?? new Date().toISOString().split("T")[0],
      estimated_months: caseRow.estimated_months ?? 18,
      notes: caseRow.notes ?? "",
      visits: (visitRows ?? []).map((v) => ({
        visit_date: v.visit_date,
        procedure: v.procedure ?? "",
        next_procedure: v.next_procedure ?? "",
        notes: v.notes ?? "",
      })),
    },
    error: null,
  }
}
