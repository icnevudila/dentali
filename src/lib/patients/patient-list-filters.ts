export type PatientStatusFilter = "all" | "active" | "inactive"

export type PatientVisitFilter = "all" | "today" | "week" | "month" | "never" | "custom"

export type PatientSort = "name" | "last_visit_desc" | "last_visit_asc"

export type PatientListFilters = {
  status: PatientStatusFilter
  visit: PatientVisitFilter
  visitFrom: string
  visitTo: string
  sort: PatientSort
}

export const DEFAULT_PATIENT_LIST_FILTERS: PatientListFilters = {
  status: "active",
  visit: "all",
  visitFrom: "",
  visitTo: "",
  sort: "name",
}

const MANILA_TZ = "Asia/Manila"

function manilaDateParts(date: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return { y: get("year"), m: get("month"), d: get("day") }
}

/** ISO timestamps for RPC bounds in Asia/Manila */
export function manilaRangeForDay(date: Date): { from: string; to: string } {
  const { y, m, d } = manilaDateParts(date)
  const pad = (n: number) => String(n).padStart(2, "0")
  const day = `${y}-${pad(m)}-${pad(d)}`
  return {
    from: `${day}T00:00:00+08:00`,
    to: `${day}T23:59:59+08:00`,
  }
}

export function resolveVisitRange(filters: PatientListFilters): {
  neverVisited: boolean
  from: string | null
  to: string | null
} {
  if (filters.visit === "never") {
    return { neverVisited: true, from: null, to: null }
  }

  const now = new Date()

  if (filters.visit === "today") {
    const { from, to } = manilaRangeForDay(now)
    return { neverVisited: false, from, to }
  }

  if (filters.visit === "week") {
    const start = new Date(now)
    start.setDate(start.getDate() - 6)
    const { from } = manilaRangeForDay(start)
    const { to } = manilaRangeForDay(now)
    return { neverVisited: false, from, to }
  }

  if (filters.visit === "month") {
    const start = new Date(now)
    start.setDate(start.getDate() - 29)
    const { from } = manilaRangeForDay(start)
    const { to } = manilaRangeForDay(now)
    return { neverVisited: false, from, to }
  }

  if (filters.visit === "custom") {
    const from = filters.visitFrom ? `${filters.visitFrom}T00:00:00+08:00` : null
    const to = filters.visitTo ? `${filters.visitTo}T23:59:59+08:00` : null
    return { neverVisited: false, from, to }
  }

  return { neverVisited: false, from: null, to: null }
}

export function parsePatientListFilters(params: URLSearchParams): PatientListFilters {
  const status = params.get("status")
  const visit = params.get("visit")
  const sort = params.get("sort")

  return {
    status:
      status === "all" || status === "inactive" || status === "active"
        ? status
        : DEFAULT_PATIENT_LIST_FILTERS.status,
    visit:
      visit === "today" ||
      visit === "week" ||
      visit === "month" ||
      visit === "never" ||
      visit === "custom" ||
      visit === "all"
        ? visit
        : DEFAULT_PATIENT_LIST_FILTERS.visit,
    visitFrom: params.get("from") ?? "",
    visitTo: params.get("to") ?? "",
    sort:
      sort === "last_visit_desc" || sort === "last_visit_asc" || sort === "name"
        ? sort
        : DEFAULT_PATIENT_LIST_FILTERS.sort,
  }
}

export function filtersToSearchParams(
  filters: PatientListFilters,
  query: string,
  page: number
): URLSearchParams {
  const params = new URLSearchParams()
  if (query) params.set("q", query)
  if (page > 1) params.set("page", String(page))
  if (filters.status !== DEFAULT_PATIENT_LIST_FILTERS.status) params.set("status", filters.status)
  if (filters.visit !== "all") params.set("visit", filters.visit)
  if (filters.visit === "custom" && filters.visitFrom) params.set("from", filters.visitFrom)
  if (filters.visit === "custom" && filters.visitTo) params.set("to", filters.visitTo)
  if (filters.sort !== "name") params.set("sort", filters.sort)
  return params
}

export function countActiveFilters(filters: PatientListFilters): number {
  let n = 0
  if (filters.status !== "active") n++
  if (filters.visit !== "all") n++
  if (filters.sort !== "name") n++
  return n
}
