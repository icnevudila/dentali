import type { AppointmentRecord } from "@/lib/appointments/appointment-service"
import type { DashboardStats } from "@/lib/dashboard/dashboard-service"
import type { InvoiceRecord } from "@/lib/billing/invoice-service"
import type { QueueEntry } from "@/lib/queue/queue-service"
import type { PatientRecord } from "@/lib/patients/patient-service"
import type { ToothFinding } from "@/lib/types/dental"

export type ShowcaseBranch = {
  id: string
  name: string
  organization_id: string
}

export type ShowcaseSnapshot = {
  branch: ShowcaseBranch
  stats: DashboardStats
  patients: PatientRecord[]
  chartPatientId: string | null
  chartFindings: ToothFinding[]
  queueEntries: QueueEntry[]
  invoices: InvoiceRecord[]
  appointments: AppointmentRecord[]
  /** Read-only landing — block mutations in showcase surfaces */
  readOnly: boolean
  source: "session" | "service_role" | "empty"
}
