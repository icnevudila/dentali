/** Heavy mask for public TV / waiting-room displays — never full names. */
export function maskPatientDisplayName(firstName?: string | null, lastName?: string | null): string | null {
  const first = (firstName ?? "").trim()
  const last = (lastName ?? "").trim()

  if (!first && !last) return null
  if (!last) return `${first.charAt(0).toUpperCase()}***`
  if (!first) return `${last.charAt(0).toUpperCase()}***`
  return `${first.charAt(0).toUpperCase()}*** ${last.charAt(0).toUpperCase()}***`
}

/** Split "Maria Santos" → masked form (showcase / client-side fallback). */
export function maskPatientFullName(fullName?: string | null): string | null {
  if (!fullName?.trim()) return null
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return maskPatientDisplayName(parts[0], null)
  return maskPatientDisplayName(parts[0], parts[parts.length - 1])
}
