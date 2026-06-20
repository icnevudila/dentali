import type { PatientConsent } from "@/lib/patients/consent-service"
import type { ConsentCatalogItem } from "@/lib/patients/consent-service"
import {
  FALLBACK_INTAKE_CONSENT_SLUGS,
  normalizeIntakeConsentSlugs,
} from "@/lib/patients/intake-consent-slugs-service"

/** Fallback when `_intake_consent_slugs` RPC is unavailable. */
export const CHECKIN_REQUIRED_CONSENT_SLUGS = FALLBACK_INTAKE_CONSENT_SLUGS

export type CheckInRequiredConsentSlug = string

/** Legacy slug — redirects to general-treatment when opened directly. */
export const MERGED_CONSENT_SLUG_ALIASES: Record<string, string> = {
  "dpa-consent": "general-treatment",
}

export function isLegacyMergedConsentSlug(slug: string): boolean {
  return slug in MERGED_CONSENT_SLUG_ALIASES
}

export function resolveConsentFormHref(patientId: string, slug: string): string {
  const target = MERGED_CONSENT_SLUG_ALIASES[slug] ?? slug
  return `/patients/${patientId}/consents/${target}`
}

export type ConsentDisplayStatus = "not_started" | "pending" | "signed" | "voided"

function requiredConsentOrder(slug: string, requiredSlugs: readonly string[]): number {
  const index = requiredSlugs.indexOf(slug)
  return index === -1 ? 999 : index
}

export function isCheckInRequiredConsentSlug(
  slug: string,
  requiredSlugs?: readonly string[]
): boolean {
  return normalizeIntakeConsentSlugs(requiredSlugs).includes(slug)
}

export function resolveConsentDisplayStatus(
  slug: string,
  consents: PatientConsent[]
): ConsentDisplayStatus {
  const record = consents.find((c) => c.template_slug === slug && c.status !== "voided")
  if (!record) return "not_started"
  if (record.status === "signed") return "signed"
  if (record.status === "voided") return "voided"
  return "pending"
}

function consentIncomplete(status: ConsentDisplayStatus): boolean {
  return status === "pending" || status === "not_started"
}

function consentStatusSortRank(status: ConsentDisplayStatus): number {
  if (consentIncomplete(status)) return 0
  if (status === "signed") return 1
  return 2
}

/** Required + unsigned consents first, then other pending, then signed. */
export function sortConsentCatalogItems(
  items: ConsentCatalogItem[],
  consents: PatientConsent[],
  requiredSlugs?: readonly string[]
): ConsentCatalogItem[] {
  const slugs = normalizeIntakeConsentSlugs(requiredSlugs)

  return [...items].sort((a, b) => {
    const statusA = resolveConsentDisplayStatus(a.slug, consents)
    const statusB = resolveConsentDisplayStatus(b.slug, consents)
    const requiredIncompleteA = isCheckInRequiredConsentSlug(a.slug, slugs) && consentIncomplete(statusA)
    const requiredIncompleteB = isCheckInRequiredConsentSlug(b.slug, slugs) && consentIncomplete(statusB)

    if (requiredIncompleteA !== requiredIncompleteB) {
      return requiredIncompleteA ? -1 : 1
    }

    const incompleteA = consentIncomplete(statusA)
    const incompleteB = consentIncomplete(statusB)
    if (incompleteA !== incompleteB) {
      return incompleteA ? -1 : 1
    }

    const rankA = consentStatusSortRank(statusA)
    const rankB = consentStatusSortRank(statusB)
    if (rankA !== rankB) return rankA - rankB

    const orderA = requiredConsentOrder(a.slug, slugs)
    const orderB = requiredConsentOrder(b.slug, slugs)
    if (orderA !== orderB) return orderA - orderB

    if (a.is_default !== b.is_default) return a.is_default ? -1 : 1

    return a.name.localeCompare(b.name)
  })
}

export function sortPatientConsentsForDisplay(
  consents: PatientConsent[],
  requiredSlugs?: readonly string[]
): PatientConsent[] {
  const slugs = normalizeIntakeConsentSlugs(requiredSlugs)

  return [...consents].sort((a, b) => {
    const requiredA = isCheckInRequiredConsentSlug(a.template_slug, slugs) && a.status === "pending"
    const requiredB = isCheckInRequiredConsentSlug(b.template_slug, slugs) && b.status === "pending"
    if (requiredA !== requiredB) return requiredA ? -1 : 1

    const pendingA = a.status === "pending"
    const pendingB = b.status === "pending"
    if (pendingA !== pendingB) return pendingA ? -1 : 1

    const orderA = requiredConsentOrder(a.template_slug, slugs)
    const orderB = requiredConsentOrder(b.template_slug, slugs)
    if (orderA !== orderB) return orderA - orderB

    return a.template_name.localeCompare(b.template_name)
  })
}

/** First intake consent blocking check-in (unsigned or not yet created). */
export function findCheckInBlockingConsentSlug(
  consents: PatientConsent[],
  requiredSlugs?: readonly string[]
): string | null {
  for (const slug of normalizeIntakeConsentSlugs(requiredSlugs)) {
    const active = consents.filter((c) => c.template_slug === slug && c.status !== "voided")
    const signed = active.some((c) => c.status === "signed")
    if (!signed) return slug
  }
  return null
}

export function resolveCheckInConsentHref(
  patientId: string,
  consents: PatientConsent[],
  requiredSlugs?: readonly string[]
): string {
  const slug =
    findCheckInBlockingConsentSlug(consents, requiredSlugs) ?? normalizeIntakeConsentSlugs(requiredSlugs)[0]
  return `/patients/${patientId}/consents/${slug}`
}

export function checkInConsentFormLabel(
  consents: PatientConsent[],
  t: (key: string, fallback: string) => string,
  requiredSlugs?: readonly string[]
): string {
  const slug = findCheckInBlockingConsentSlug(consents, requiredSlugs)
  if (!slug) {
    return t("queue.openRequiredConsent", "Sign required consent")
  }
  const record = consents.find((c) => c.template_slug === slug && c.status !== "voided")
  const name = record?.template_name ?? "Data Privacy & General Treatment Consent"
  return t("queue.openRequiredConsentNamed", "Sign: {name}").replace("{name}", name)
}
