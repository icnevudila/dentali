/**
 * Sanity check for public-channel error sanitization
 * (run: npx tsx scripts/verify-public-channel-safe-error.ts)
 */
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import {
  ERROR_COPY,
  isTechnicalPublicChannelError,
  kioskCheckInSafeError,
  publicChannelSafeError,
} from "../src/lib/kiosk/public-channel-errors"

const FALLBACK = ERROR_COPY.frontDesk

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
    label: "hides SQLSTATE codes",
    ok: publicChannelSafeError("duplicate key value violates unique constraint 23505", FALLBACK) === FALLBACK,
  },
  {
    label: "hides fetch failed",
    ok: publicChannelSafeError("TypeError: fetch failed", FALLBACK) === FALLBACK,
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
  {
    label: "ERROR_COPY.sessionFailed present",
    ok: ERROR_COPY.sessionFailed.includes("front desk"),
  },
  {
    label: "ERROR_COPY.pdaLinkInvalid present",
    ok: ERROR_COPY.pdaLinkInvalid.toLowerCase().includes("expired"),
  },
]

const publicErrorRoutes = [
  "src/app/kiosk/error.tsx",
  "src/app/portal/error.tsx",
  "src/app/display/error.tsx",
  "src/app/pda/error.tsx",
  "src/app/sign/error.tsx",
  "src/app/check-in/error.tsx",
]

for (const rel of publicErrorRoutes) {
  const path = join(process.cwd(), rel)
  const ok = existsSync(path) && readFileSync(path, "utf8").includes("publicSurface")
  cases.push({ label: `${rel} has publicSurface`, ok })
}

const publicLoadingRoutes = [
  "src/app/kiosk/loading.tsx",
  "src/app/portal/loading.tsx",
  "src/app/display/loading.tsx",
  "src/app/pda/loading.tsx",
  "src/app/check-in/loading.tsx",
  "src/app/sign/[token]/loading.tsx",
]

for (const rel of publicLoadingRoutes) {
  cases.push({ label: `${rel} exists`, ok: existsSync(join(process.cwd(), rel)) })
}

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
