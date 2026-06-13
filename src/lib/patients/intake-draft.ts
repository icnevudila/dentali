import type { PatientFormValues } from "@/lib/validations/patient"

const KEY_PREFIX = "ph-dental:intake-draft"

export type IntakeInsuranceDraft = {
  payerType: "none" | "hmo" | "philhealth" | "private"
  payerName: string
  memberId: string
  planName: string
}

export interface IntakeDraft {
  branchId: string
  userId: string
  values: PatientFormValues
  insurance?: IntakeInsuranceDraft
  savedAt: string
}

function draftKey(branchId: string, userId: string): string {
  return `${KEY_PREFIX}:${branchId}:${userId}`
}

export function hasIntakeDraftContent(values: Partial<PatientFormValues>): boolean {
  return Boolean(
    values.firstName?.trim() ||
      values.lastName?.trim() ||
      values.phoneNumber?.trim() ||
      values.email?.trim() ||
      values.addressLine1?.trim()
  )
}

export function saveIntakeDraft(
  branchId: string,
  userId: string,
  values: PatientFormValues,
  insurance?: IntakeInsuranceDraft
): { savedAt: string } {
  const savedAt = new Date().toISOString()
  const draft: IntakeDraft = { branchId, userId, values, insurance, savedAt }
  localStorage.setItem(draftKey(branchId, userId), JSON.stringify(draft))
  return { savedAt }
}

export function loadIntakeDraft(
  branchId: string,
  userId: string
): IntakeDraft | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(draftKey(branchId, userId))
    if (!raw) return null
    const draft = JSON.parse(raw) as IntakeDraft
    if (draft.branchId !== branchId || draft.userId !== userId) return null
    return draft
  } catch {
    return null
  }
}

export function clearIntakeDraft(branchId: string, userId: string): void {
  localStorage.removeItem(draftKey(branchId, userId))
}

export function formatDraftSavedAt(iso: string): string {
  return new Date(iso).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}
