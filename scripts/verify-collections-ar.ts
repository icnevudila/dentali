/**
 * Smoke checks for collections AR aging helpers (no network / no PHI).
 * Run: npx tsx scripts/verify-collections-ar.ts
 */
import { classifyAgingBucket } from "../src/lib/billing/collections-aging"

const cases: Array<{ days: number; expect: ReturnType<typeof classifyAgingBucket> }> = [
  { days: 0, expect: "0_30" },
  { days: 30, expect: "0_30" },
  { days: 31, expect: "31_60" },
  { days: 60, expect: "31_60" },
  { days: 61, expect: "60_plus" },
  { days: -5, expect: "0_30" },
]

let failed = 0
for (const c of cases) {
  const got = classifyAgingBucket(c.days)
  if (got !== c.expect) {
    console.error(`classifyAgingBucket(${c.days}) => ${got}, expected ${c.expect}`)
    failed += 1
  }
}

if (failed > 0) {
  console.error(`FAILED: ${failed} case(s)`)
  process.exit(1)
}

console.log("verify-collections-ar: ok")
