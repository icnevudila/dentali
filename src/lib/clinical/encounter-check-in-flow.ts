import {
  closePatientEncounter,
  encounterPublicId,
  fetchActiveEncounter,
  type PatientEncounterDetail,
} from "@/lib/clinical/encounter-service"

export type EncounterCheckInChoice = "close_and_new" | "reuse" | "cancel"

export type EncounterCheckInContext = {
  patientId: string
  branchId: string
  patientName?: string
}

export type OpenEncounterPrompt = {
  encounter: PatientEncounterDetail
  displayCode: string
  openedLabel: string
  isPriorDay: boolean
}

const MANILA_TZ = "Asia/Manila"

export function encounterDayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: MANILA_TZ })
}

export function isPriorDayEncounter(openedAt: string, now = new Date()): boolean {
  return encounterDayKey(openedAt) !== encounterDayKey(now.toISOString())
}

export async function loadOpenEncounterPrompt(
  patientId: string,
  branchId: string
): Promise<{ prompt: OpenEncounterPrompt | null; error: string | null }> {
  const { data, error } = await fetchActiveEncounter(patientId, branchId)
  if (error) return { prompt: null, error }
  if (!data || data.encounter.status !== "open") return { prompt: null, error: null }

  const openedAt = data.encounter.opened_at
  const openedLabel = new Date(openedAt).toLocaleString(undefined, {
    timeZone: MANILA_TZ,
    dateStyle: "medium",
    timeStyle: "short",
  })

  return {
    prompt: {
      encounter: data,
      displayCode: encounterPublicId(data.encounter),
      openedLabel,
      isPriorDay: isPriorDayEncounter(openedAt),
    },
    error: null,
  }
}

export async function applyEncounterCheckInChoice(
  choice: EncounterCheckInChoice,
  prompt: OpenEncounterPrompt
): Promise<{ reuseEncounterId: string | null; error: string | null }> {
  if (choice === "cancel") {
    return { reuseEncounterId: null, error: null }
  }

  if (choice === "reuse") {
    return { reuseEncounterId: prompt.encounter.encounter.id, error: null }
  }

  const { error } = await closePatientEncounter(prompt.encounter.encounter.id)
  if (error) return { reuseEncounterId: null, error }
  return { reuseEncounterId: null, error: null }
}
