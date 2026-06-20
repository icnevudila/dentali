import { createClient } from "@/lib/supabase/client"

export const FALLBACK_INTAKE_CONSENT_SLUGS = ["general-treatment"] as const

const CACHE_TTL_MS = 5 * 60 * 1000
const slugCache = new Map<string, { slugs: string[]; expiresAt: number }>()

export function normalizeIntakeConsentSlugs(slugs?: readonly string[] | null): readonly string[] {
  const filtered = (slugs ?? []).filter((slug) => typeof slug === "string" && slug.trim().length > 0)
  return filtered.length > 0 ? filtered : [...FALLBACK_INTAKE_CONSENT_SLUGS]
}

export async function fetchIntakeConsentSlugs(organizationId: string): Promise<string[]> {
  const cached = slugCache.get(organizationId)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.slugs
  }

  const supabase = createClient()
  const { data, error } = await supabase.rpc("_intake_consent_slugs", {
    p_org_id: organizationId,
  })

  if (error) {
    return [...FALLBACK_INTAKE_CONSENT_SLUGS]
  }

  const slugs = normalizeIntakeConsentSlugs(Array.isArray(data) ? data : [])
  slugCache.set(organizationId, {
    slugs: [...slugs],
    expiresAt: Date.now() + CACHE_TTL_MS,
  })
  return [...slugs]
}

export function invalidateIntakeConsentSlugCache(organizationId?: string) {
  if (organizationId) {
    slugCache.delete(organizationId)
    return
  }
  slugCache.clear()
}
