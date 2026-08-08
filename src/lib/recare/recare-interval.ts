/** Workflow settings JSON key for hygiene / recare interval (months). */
export const HYGIENE_RECALL_MONTHS_KEY = "hygiene_recall_months"

/** Default matches enqueue_hygiene_recalls / recall-reminder-cron when unset. */
export const DEFAULT_RECARE_INTERVAL_MONTHS = 6

export const MIN_RECARE_INTERVAL_MONTHS = 1
export const MAX_RECARE_INTERVAL_MONTHS = 24

/**
 * Clamp a configured recall interval. Returns null when value is missing/invalid
 * so callers can fall back to the clinic default.
 */
export function parseRecareIntervalMonths(value: unknown): number | null {
  let raw: number | null = null
  if (typeof value === "number" && Number.isFinite(value)) {
    raw = value
  } else if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value.trim())
    if (Number.isFinite(parsed)) raw = parsed
  }
  if (raw === null) return null
  const months = Math.trunc(raw)
  if (months < MIN_RECARE_INTERVAL_MONTHS || months > MAX_RECARE_INTERVAL_MONTHS) {
    return null
  }
  return months
}

/** Resolve interval from workflow settings payload; default 6 when absent. */
export function resolveRecareIntervalMonthsFromSettings(
  settings: Record<string, unknown> | null | undefined
): number {
  if (!settings) return DEFAULT_RECARE_INTERVAL_MONTHS
  return (
    parseRecareIntervalMonths(settings[HYGIENE_RECALL_MONTHS_KEY]) ??
    DEFAULT_RECARE_INTERVAL_MONTHS
  )
}
