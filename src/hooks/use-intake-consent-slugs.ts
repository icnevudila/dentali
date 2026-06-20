"use client"

import * as React from "react"
import {
  FALLBACK_INTAKE_CONSENT_SLUGS,
  fetchIntakeConsentSlugs,
  normalizeIntakeConsentSlugs,
} from "@/lib/patients/intake-consent-slugs-service"

export function useIntakeConsentSlugs(organizationId: string | null | undefined) {
  const [slugs, setSlugs] = React.useState<readonly string[]>(FALLBACK_INTAKE_CONSENT_SLUGS)

  React.useEffect(() => {
    if (!organizationId) {
      setSlugs(FALLBACK_INTAKE_CONSENT_SLUGS)
      return
    }

    let cancelled = false
    void fetchIntakeConsentSlugs(organizationId).then((next) => {
      if (!cancelled) {
        setSlugs(normalizeIntakeConsentSlugs(next))
      }
    })

    return () => {
      cancelled = true
    }
  }, [organizationId])

  return slugs
}
