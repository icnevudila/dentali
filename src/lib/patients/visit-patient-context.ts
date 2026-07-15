import type { ClinicalVisitStep } from "@/lib/clinical/clinical-visit-journey"

const CONTEXT_KEY = "dentql:visit-patient-context:v1"
const JOURNEY_KEY_PREFIX = "dentql:visit-journey:"

export type VisitPatientContext = {
  patientId: string
  patientName?: string
  updatedAt: number
}

export type VisitJourneyCache = {
  patientId: string
  nextStep: ClinicalVisitStep | null
  readyToClose: boolean
  hasOpenVisit: boolean
  updatedAt: number
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** Remember which patient the clinician is working on (billing is outside /patients/[id]). */
export function rememberVisitPatientContext(patientId: string, patientName?: string) {
  if (typeof window === "undefined" || !patientId) return
  const payload: VisitPatientContext = {
    patientId,
    patientName,
    updatedAt: Date.now(),
  }
  try {
    sessionStorage.setItem(CONTEXT_KEY, JSON.stringify(payload))
  } catch {
    // Private mode / quota — ignore
  }
}

export function readVisitPatientContext(): VisitPatientContext | null {
  if (typeof window === "undefined") return null
  try {
    return safeParse<VisitPatientContext>(sessionStorage.getItem(CONTEXT_KEY))
  } catch {
    return null
  }
}

export function writeVisitJourneyCache(cache: Omit<VisitJourneyCache, "updatedAt">) {
  if (typeof window === "undefined" || !cache.patientId) return
  const payload: VisitJourneyCache = { ...cache, updatedAt: Date.now() }
  try {
    sessionStorage.setItem(`${JOURNEY_KEY_PREFIX}${cache.patientId}`, JSON.stringify(payload))
  } catch {
    // ignore
  }
}

export function readVisitJourneyCache(patientId: string): VisitJourneyCache | null {
  if (typeof window === "undefined" || !patientId) return null
  try {
    const parsed = safeParse<VisitJourneyCache>(
      sessionStorage.getItem(`${JOURNEY_KEY_PREFIX}${patientId}`)
    )
    if (!parsed || parsed.patientId !== patientId) return null
    // Stale after 2 hours
    if (Date.now() - parsed.updatedAt > 2 * 60 * 60 * 1000) return null
    return parsed
  } catch {
    return null
  }
}
