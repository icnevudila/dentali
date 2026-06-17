const STORAGE_KEY = "dentql:kiosk-sign-return"
const MAX_AGE_MS = 2 * 60 * 60 * 1000

export type KioskSignReturn = {
  kioskToken: string
  phone: string
  lastName: string
  savedAt: number
}

export function saveKioskSignReturn(data: Omit<KioskSignReturn, "savedAt">): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...data, savedAt: Date.now() })
    )
  } catch {
    // signing still works without return path
  }
}

export function readKioskSignReturn(kioskToken?: string | null): KioskSignReturn | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as KioskSignReturn
    if (!parsed?.kioskToken || !parsed.phone || !parsed.lastName) return null
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      sessionStorage.removeItem(STORAGE_KEY)
      return null
    }
    if (kioskToken && parsed.kioskToken !== kioskToken) return null
    return parsed
  } catch {
    return null
  }
}

export function clearKioskSignReturn(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
