/**
 * Quick sanity check for display name masking (run: npx tsx scripts/verify-mask-patient-name.ts)
 */
import { maskPatientDisplayName, maskPatientFullName } from "../src/lib/display/mask-patient-name"

const cases: { fn: () => string | null; expect: string | null }[] = [
  { fn: () => maskPatientDisplayName("Maria", "Santos"), expect: "M*** S***" },
  { fn: () => maskPatientDisplayName("Juan", null), expect: "J***" },
  { fn: () => maskPatientDisplayName(null, "Cruz"), expect: "C***" },
  { fn: () => maskPatientDisplayName("", ""), expect: null },
  { fn: () => maskPatientFullName("Maria Santos"), expect: "M*** S***" },
]

let failed = 0
for (const { fn, expect: expected } of cases) {
  const got = fn()
  if (got !== expected) {
    console.error(`FAIL: expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`)
    failed++
  }
}

if (failed > 0) {
  process.exit(1)
}
console.log(`OK: ${cases.length} mask cases passed`)
