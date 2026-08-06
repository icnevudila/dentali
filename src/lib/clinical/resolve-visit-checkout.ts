import { fetchActiveEncounter } from "@/lib/clinical/encounter-service"
import type { QueueEntry } from "@/lib/queue/queue-service"

/**
 * Prefer the queue entry's linked encounter; fall back to today's open visit.
 * Used when board actions open Finish visit without a guaranteed encounter_id.
 */
export async function resolveVisitCheckoutEncounterId(
  entry: Pick<QueueEntry, "patient_id" | "encounter_id">,
  branchId: string | null | undefined
): Promise<string | null> {
  if (entry.encounter_id) return entry.encounter_id
  if (!branchId) return null
  const { data } = await fetchActiveEncounter(entry.patient_id, branchId)
  if (data?.encounter.status === "open") return data.encounter.id
  return data?.encounter.id ?? null
}
