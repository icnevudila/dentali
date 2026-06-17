import type { AppointmentRecord } from "@/lib/appointments/types"
import {
  fetchPatientRecordsByIds,
  type PatientRecord,
} from "@/lib/patients/patient-service"
import { fetchQueueEntries, fetchQueueEntriesForDay, type QueueEntry, type QueueStatus } from "@/lib/queue/queue-service"
import {
  DAY_SCOPED_QUEUE_FILTERS,
  filterQueueBoardEntries,
  parseQueueBoardFilter,
  type QueueBoardFilter,
} from "@/lib/queue/queue-board-filter"

export type DentistBoardFilter = QueueBoardFilter

const STATUS_PRIORITY: Record<QueueStatus, number> = {
  in_chair: 0,
  now_serving: 1,
  ready: 2,
  waiting: 3,
  served: 99,
  cancelled: 99,
}

export function sortDentistBoardEntries(entries: QueueEntry[]): QueueEntry[] {
  return [...entries].sort((a, b) => {
    const byStatus = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]
    if (byStatus !== 0) return byStatus
    return new Date(a.checked_in_at).getTime() - new Date(b.checked_in_at).getTime()
  })
}

export function filterDentistBoardEntries(
  entries: QueueEntry[],
  filter: DentistBoardFilter
): QueueEntry[] {
  return filterQueueBoardEntries(entries, filter)
}

export function countDentistBoardEntries(entries: QueueEntry[]) {
  return {
    total: entries.length,
    inChair: entries.filter((e) => e.status === "in_chair").length,
    nowServing: entries.filter((e) => e.status === "now_serving").length,
    waiting: entries.filter((e) => e.status === "waiting" || e.status === "ready").length,
  }
}

export function matchesDentistSearch(entry: QueueEntry, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const name = (entry.patient_name ?? "").toLowerCase()
  const code = entry.display_code.toLowerCase()
  const chair = (entry.chair_label ?? "").toLowerCase()
  const patientNo = (entry.patient_number ?? "").toLowerCase()
  return name.includes(q) || code.includes(q) || chair.includes(q) || patientNo.includes(q)
}

export function parseDentistBoardFilter(value: string | null): DentistBoardFilter {
  return parseQueueBoardFilter(value)
}

export type ChairQueueSectionId = "in_chair" | "now_serving" | "waiting"

export type ChairQueueSection = {
  id: ChairQueueSectionId
  labelKey: string
  fallback: string
  entries: QueueEntry[]
}

const SECTION_DEFS: { id: ChairQueueSectionId; labelKey: string; fallback: string }[] = [
  { id: "in_chair", labelKey: "dentist.sectionInChair", fallback: "In chair now" },
  { id: "now_serving", labelKey: "dentist.sectionServing", fallback: "Called — on the way" },
  { id: "waiting", labelKey: "dentist.sectionWaiting", fallback: "Waiting in line" },
]

export type DentistQueueSearchResult = {
  data: PatientRecord[]
  total: number
  queueByPatientId: Record<string, QueueEntry>
  error: string | null
}

export function filterDentistBoardByProvider(
  entries: QueueEntry[],
  providerId: string | null | undefined
): QueueEntry[] {
  if (!providerId) return entries
  return entries.filter(
    (entry) => entry.provider_id == null || entry.provider_id === providerId
  )
}

export function filterUpcomingByProvider(
  appointments: AppointmentRecord[],
  providerId: string | null | undefined
): AppointmentRecord[] {
  if (!providerId) return appointments
  return appointments.filter((a) => a.provider_id == null || a.provider_id === providerId)
}

const DAY_SCOPED_FILTERS = DAY_SCOPED_QUEUE_FILTERS

export async function searchDentistQueuePatients(
  branchId: string,
  options: {
    query?: string
    filter?: DentistBoardFilter
    providerId?: string | null
    page?: number
    pageSize?: number
    clinicDay?: string
  } = {}
): Promise<DentistQueueSearchResult> {
  const filter = options.filter ?? "all"
  const page = Math.max(1, options.page ?? 1)
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 20))
  const query = options.query ?? ""

  const needsDayScope = DAY_SCOPED_FILTERS.includes(filter) && Boolean(options.clinicDay)
  const { data: entries, error } = needsDayScope
    ? await fetchQueueEntriesForDay(branchId, options.clinicDay!)
    : await fetchQueueEntries(branchId, true)
  if (error) return { data: [], total: 0, queueByPatientId: {}, error }

  let filtered = filterDentistBoardByProvider(
    filterDentistBoardEntries(sortDentistBoardEntries(entries), filter),
    options.providerId
  )
  if (query.trim()) {
    filtered = filtered.filter((entry) => matchesDentistSearch(entry, query))
  }

  const total = filtered.length
  const offset = (page - 1) * pageSize
  const pageEntries = filtered.slice(offset, offset + pageSize)
  const pageIds = pageEntries.map((entry) => entry.patient_id)

  const recordsResult = await fetchPatientRecordsByIds(pageIds, branchId)
  if (recordsResult.error) {
    return { data: [], total, queueByPatientId: {}, error: recordsResult.error }
  }

  const recordById = new Map(recordsResult.data.map((patient) => [patient.id, patient]))
  const orderedPatients = pageIds
    .map((id) => recordById.get(id))
    .filter((patient): patient is PatientRecord => Boolean(patient))

  const queueByPatientId = Object.fromEntries(
    pageEntries.map((entry) => [entry.patient_id, entry])
  )

  return { data: orderedPatients, total, queueByPatientId, error: null }
}

export function groupChairQueueSections(entries: QueueEntry[]): ChairQueueSection[] {
  const byStatus = (statuses: QueueStatus[]) =>
    entries.filter((e) => statuses.includes(e.status))

  return SECTION_DEFS.map((def) => ({
    ...def,
    entries:
      def.id === "waiting"
        ? byStatus(["waiting", "ready"])
        : byStatus([def.id]),
  })).filter((section) => section.entries.length > 0)
}
