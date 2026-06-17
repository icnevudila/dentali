import type { PatientConsent } from "@/lib/patients/consent-service"

/** Must match `public._pending_intake_consent_count` in Supabase. */
export const CHECKIN_REQUIRED_CONSENT_SLUGS = ["general-treatment", "dpa-consent"] as const

export type CheckInRequiredConsentSlug = (typeof CHECKIN_REQUIRED_CONSENT_SLUGS)[number]

const CHECKIN_CONSENT_PRIORITY: CheckInRequiredConsentSlug[] = [
  "general-treatment",
  "dpa-consent",
]

/** First intake consent blocking check-in (unsigned or not yet created). */
export function findCheckInBlockingConsentSlug(
  consents: PatientConsent[]
): CheckInRequiredConsentSlug | null {
  for (const slug of CHECKIN_CONSENT_PRIORITY) {
    const active = consents.filter((c) => c.template_slug === slug && c.status !== "voided")
    const signed = active.some((c) => c.status === "signed")
    if (!signed) return slug
  }
  return null
}

export function resolveCheckInConsentHref(patientId: string, consents: PatientConsent[]): string {
  const slug = findCheckInBlockingConsentSlug(consents) ?? "general-treatment"
  return `/patients/${patientId}/consents/${slug}`
}

export function checkInConsentFormLabel(
  consents: PatientConsent[],
  t: (key: string, fallback: string) => string
): string {
  const slug = findCheckInBlockingConsentSlug(consents)
  if (!slug) {
    return t("queue.openRequiredConsent", "Sign required consent")
  }
  const record = consents.find((c) => c.template_slug === slug && c.status !== "voided")
  const name = record?.template_name ?? (slug === "general-treatment" ? "General Treatment Consent" : "Data Privacy Consent")
  return t("queue.openRequiredConsentNamed", "Sign: {name}").replace("{name}", name)
}
