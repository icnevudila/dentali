export interface AppointmentRecord {
  id: string
  scheduled_at: string
  purpose: string | null
  status: string
  patient_id: string
  patient_name?: string
  provider_id?: string | null
}

