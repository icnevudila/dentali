/**
 * Sanity check for public-channel error sanitization
 * (run: npx tsx scripts/verify-public-channel-safe-error.ts)
 */
import {
  isTechnicalPublicChannelError,
  kioskCheckInSafeError,
  publicChannelSafeError,
} from "../src/lib/kiosk/kiosk-service"

const FALLBACK = "Please see the front desk."

const cases: { label: string; ok: boolean }[] = [
  {
    label: "allows patient copy",
    ok:
      publicChannelSafeError("We could not find a matching appointment.", FALLBACK) ===
      "We could not find a matching appointment.",
  },
  {
    label: "hides PGRST",
    ok: publicChannelSafeError("PGRST202: Could not find the function", FALLBACK) === FALLBACK,
  },
  {
    label: "hides postgres",
    ok: publicChannelSafeError("postgres error: duplicate key", FALLBACK) === FALLBACK,
  },
  {
    label: "hides Failed to fetch",
    ok: publicChannelSafeError("Failed to fetch", FALLBACK) === FALLBACK,
  },
  {
    label: "hides stack-like TypeError",
    ok:
      publicChannelSafeError("TypeError: Cannot read properties of undefined", FALLBACK) ===
      FALLBACK,
  },
  {
    label: "null → fallback",
    ok: publicChannelSafeError(null, FALLBACK) === FALLBACK,
  },
  {
    label: "kiosk check-in allows known copy",
    ok:
      kioskCheckInSafeError("You are already checked in today.", FALLBACK) ===
      "You are already checked in today.",
  },
  {
    label: "kiosk check-in hides queue helper",
    ok:
      kioskCheckInSafeError("function _next_queue_display_code is not unique", FALLBACK) ===
      FALLBACK,
  },
  {
    label: "technical detector",
    ok: isTechnicalPublicChannelError("JWT expired") === true,
  },
]

let failed = 0
for (const { label, ok } of cases) {
  if (!ok) {
    console.error(`FAIL: ${label}`)
    failed++
  }
}

if (failed > 0) {
  process.exit(1)
}
console.log(`OK: ${cases.length} publicChannelSafeError cases passed`)
