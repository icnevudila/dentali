import { getClinicalNote } from "@/lib/clinical/clinical-notes-service"
import {
  encounterPublicId,
  fetchEncounterDetail,
  fetchPatientEncounters,
} from "@/lib/clinical/encounter-service"
import { getTreatmentPlan } from "@/lib/clinical/treatment-plan-service"

export type CarryForwardNote = {
  sourceEncounterId: string
  sourceLabel: string
  noteId: string
  title: string
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
  signedAt: string | null
}

export type CarryForwardPlan = {
  sourceEncounterId: string
  sourceLabel: string
  planId: string
  title: string
  itemCount: number
  status: string
}

export type CarryForwardSources = {
  note: CarryForwardNote | null
  plan: CarryForwardPlan | null
}

export async function fetchCarryForwardSources(
  patientId: string,
  branchId: string,
  options?: { excludeEncounterId?: string }
): Promise<{ data: CarryForwardSources; error: string | null }> {
  const { data: encounters, error } = await fetchPatientEncounters(patientId, branchId, 30)
  if (error) return { data: { note: null, plan: null }, error }

  const closed = encounters.filter(
    (encounter) =>
      encounter.status === "closed" &&
      encounter.id !== options?.excludeEncounterId &&
      (encounter.note_count > 0 || encounter.plan_count > 0)
  )

  let note: CarryForwardNote | null = null
  let plan: CarryForwardPlan | null = null

  for (const summary of closed) {
    if (note && plan) break

    const { data: detail } = await fetchEncounterDetail(summary.id)
    if (!detail) continue

    const label = encounterPublicId(detail.encounter)

    if (!note && detail.notes.length > 0) {
      const pick = [...detail.notes].sort((a, b) => {
        if (a.status === "signed" && b.status !== "signed") return -1
        if (b.status === "signed" && a.status !== "signed") return 1
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })[0]

      if (pick) {
        const { data: full } = await getClinicalNote(pick.id)
        if (full) {
          note = {
            sourceEncounterId: summary.id,
            sourceLabel: label,
            noteId: full.id,
            title: full.title,
            subjective: full.subjective,
            objective: full.objective,
            assessment: full.assessment,
            plan: full.plan,
            signedAt: full.signed_at,
          }
        }
      }
    }

    if (!plan && detail.plans.length > 0) {
      const pick = [...detail.plans].sort((a, b) => {
        const score = (status: string) =>
          status === "approved" || status === "completed" || status === "in_progress" ? 2 : 1
        const byStatus = score(b.status) - score(a.status)
        if (byStatus !== 0) return byStatus
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })[0]

      if (pick) {
        const { items } = await getTreatmentPlan(pick.id)
        plan = {
          sourceEncounterId: summary.id,
          sourceLabel: label,
          planId: pick.id,
          title: pick.title,
          itemCount: items.length,
          status: pick.status,
        }
      }
    }
  }

  return { data: { note, plan }, error: null }
}
