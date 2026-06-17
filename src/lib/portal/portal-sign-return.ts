const STORAGE_KEY = "dentql:portal-sign-return"
const MAX_AGE_MS = 2 * 60 * 60 * 1000

export type PortalSignReturn = {
  portalToken: string
  phone: string
  lastName: string
  savedAt: number
}

export function savePortalSignReturn(
  data: Omit<PortalSignReturn, "savedAt">
): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...data, savedAt: Date.now() })
    )
  } catch {
    // Private browsing / quota — signing still works without return path
  }
}

export function readPortalSignReturn(portalToken?: string | null): PortalSignReturn | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PortalSignReturn
    if (!parsed?.portalToken || !parsed.phone || !parsed.lastName) return null
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      sessionStorage.removeItem(STORAGE_KEY)
      return null
    }
    if (portalToken && parsed.portalToken !== portalToken) return null
    return parsed
  } catch {
    return null
  }
}

export function clearPortalSignReturn(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
