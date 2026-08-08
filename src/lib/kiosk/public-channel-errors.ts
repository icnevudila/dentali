/**
 * Patient-facing error sanitization for public channels
 * (kiosk / portal / TV display / PDA / sign / check-in).
 * Keep this module free of Supabase / Next client imports so verify scripts stay light.
 */

/** Shared patient-facing copy for public channels. */
export const ERROR_COPY = {
  frontDesk: "Please see the front desk.",
  generic: "Something went wrong. Please try again or see the front desk.",
  sessionFailed: "Unable to start this session. Please see the front desk.",
  connectionInvalid: "Connection is invalid or has expired.",
  consentSignFailed: "Could not open the signing form. Please see the front desk.",
  signLinkInvalid: "This signing link is invalid or has expired.",
  displayFailed: "Unable to load the queue display. Please check with the front desk.",
  pdaLinkInvalid:
    "This link is invalid or has expired. Please ask the clinic for a new form link.",
  pdaSubmitFailed: "We could not submit your form. Please try again or see the front desk.",
  checkInFailed: "Check-in could not be completed. Please see the front desk.",
} as const

function isPublicIntakeSchemaError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes("intake_profile") ||
    lower.includes("submit_kiosk_intake") ||
    lower.includes("schema cache") ||
    lower.includes("could not find the function") ||
    lower.includes("pgrst202")
  )
}

const PUBLIC_INTAKE_SQL_HINT =
  "Portal/kiosk intake SQL is not fully applied. Run supabase/scripts/APPLY_PUBLIC_INTAKE_PROFILE_HARDENING.sql in Supabase SQL Editor, then retry."

/** True when a message looks like Postgres / PostgREST / network plumbing — never show on public devices. */
export function isTechnicalPublicChannelError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    isPublicIntakeSchemaError(message) ||
    message.includes(PUBLIC_INTAKE_SQL_HINT) ||
    lower.includes("pgrst") ||
    lower.includes("postgrest") ||
    lower.includes("postgres") ||
    lower.includes("sqlstate") ||
    lower.includes("jwt") ||
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("typeerror") ||
    lower.includes("edge function") ||
    lower.includes("functions.invoke") ||
    lower.includes("row-level security") ||
    lower.includes("permission denied") ||
    lower.includes("relation ") ||
    lower.includes("column ") ||
    lower.includes("syntax error") ||
    lower.includes("rpc ") ||
    lower.includes("supabase") ||
    lower.includes("_next_queue_display_code") ||
    lower.includes("queue_display_code") ||
    (lower.includes("function") && lower.includes("is not unique")) ||
    lower.includes("econnrefused") ||
    lower.includes("fetch failed") ||
    lower.includes("http 4") ||
    lower.includes("http 5") ||
    lower.includes("status code") ||
    /\b(42p01|42703|23505|pgrst\d+)\b/i.test(message) ||
    /^(error|exception|stack|undefined|null)\b/i.test(message.trim()) ||
    /^[A-Z][a-zA-Z]+Error:/.test(message.trim())
  )
}

/**
 * Sanitize errors for portal / kiosk / PDA / TV / sign.
 * Known patient-facing copy is allowed; everything else becomes `fallback`.
 */
export function publicChannelSafeError(
  error: string | null | undefined,
  fallback: string
): string {
  if (!error) return fallback
  const trimmed = error.trim()
  if (!trimmed) return fallback
  if (isTechnicalPublicChannelError(trimmed)) return fallback
  if (trimmed.includes("\n") || trimmed.length > 180) return fallback
  return trimmed
}

/** Hide raw Postgres errors from kiosk/portal patients. */
export function kioskCheckInSafeError(
  error: string | null | undefined,
  fallback: string
): string {
  if (!error) return fallback
  if (isTechnicalPublicChannelError(error)) {
    return fallback
  }
  const trimmed = error.trim()
  if (
    trimmed.startsWith("We could not find") ||
    trimmed.startsWith("Please see the front desk") ||
    trimmed.startsWith("You are already checked in") ||
    trimmed.startsWith("Phone and last name") ||
    trimmed.startsWith("Kiosk session expired") ||
    trimmed.startsWith("Your registration") ||
    trimmed.includes("REGISTRATION_PENDING")
  ) {
    return trimmed
  }
  return fallback
}

export { PUBLIC_INTAKE_SQL_HINT, isPublicIntakeSchemaError }
