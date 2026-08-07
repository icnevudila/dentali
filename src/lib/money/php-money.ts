/**
 * PHP money helpers — integer centavos as the source of truth for UI input.
 *
 * Ledger / RPC still accept peso major units (numeric(12,2)); convert only
 * through this integer path. Do not use parseFloat on user money strings.
 */

/** Matches whole pesos with optional 1–2 decimal places (centavos). */
const MONEY_INPUT_RE = /^(\d+)(?:\.(\d{1,2}))?$/

/**
 * Parse a user-facing PHP peso string into integer centavos.
 * Accepts optional ₱ / PHP / thousands commas. Rejects >2 decimal places.
 */
export function parseMoneyToCentavos(raw: string): number | null {
  const cleaned = raw
    .trim()
    .replace(/\u00a0/g, " ")
    .replace(/₱/g, "")
    .replace(/PHP/gi, "")
    .replace(/,/g, "")
    .replace(/\s+/g, "")

  if (!cleaned) return null

  const match = MONEY_INPUT_RE.exec(cleaned)
  if (!match) return null

  const wholePesos = Number.parseInt(match[1], 10)
  if (!Number.isFinite(wholePesos) || wholePesos < 0) return null

  const frac = (match[2] ?? "").padEnd(2, "0").slice(0, 2)
  const fracCentavos = Number.parseInt(frac, 10)
  if (!Number.isFinite(fracCentavos)) return null

  return wholePesos * 100 + fracCentavos
}

/** Convert integer centavos to peso major units for numeric ledger/RPC APIs. */
export function centavosToPesoMajor(centavos: number): number {
  if (!Number.isInteger(centavos)) {
    throw new Error("centavos must be an integer")
  }
  return Number((centavos / 100).toFixed(2))
}

/**
 * Convert a peso major value already in memory (DB/API) to centavos.
 * Only for values that did not come from raw user text input.
 */
export function pesoMajorToCentavos(pesos: number): number {
  if (!Number.isFinite(pesos)) return 0
  return Math.round(pesos * 100)
}

/** Format centavos for controlled inputs (always 2 decimal places). */
export function centavosToInputValue(centavos: number): string {
  if (!Number.isInteger(centavos)) {
    throw new Error("centavos must be an integer")
  }
  return (centavos / 100).toFixed(2)
}

/**
 * Parse user peso text → peso major via centavos (never parseFloat as SoT).
 * Returns null when the input is empty or invalid.
 */
export function parseMoneyToPesoMajor(raw: string): number | null {
  const centavos = parseMoneyToCentavos(raw)
  if (centavos === null) return null
  return centavosToPesoMajor(centavos)
}

/** en-PH currency display from centavos. */
export function formatCentavosAsPhp(centavos: number, locale = "en-PH"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(centavos / 100)
}
