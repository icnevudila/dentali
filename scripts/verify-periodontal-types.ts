/**
 * Smoke checks for periodontal chart helpers (no PHI).
 * Run: npx tsx scripts/verify-periodontal-types.ts
 */
import {
  countPerioAlerts,
  emptyPeriodontalChart,
  mergePeriodontalChart,
  type PeriodontalChartData,
} from "../src/lib/odontogram/periodontal-types"

let failed = 0

const empty = emptyPeriodontalChart()
if (!empty["11"] || Object.keys(empty["11"]).length !== 0) {
  console.error("emptyPeriodontalChart missing tooth 11")
  failed += 1
}
if (countPerioAlerts(empty).teethRecorded !== 0) {
  console.error("empty chart should have zero teethRecorded")
  failed += 1
}

const stored: PeriodontalChartData = {
  "16": { mb: { depth: 5, bop: true }, b: { depth: 3 } },
  "26": { db: { depth: 4 } },
}
const merged = mergePeriodontalChart(stored)
const alerts = countPerioAlerts(merged)
if (merged["16"]?.mb?.depth !== 5) {
  console.error("merge did not keep pocket depth")
  failed += 1
}
if (alerts.pockets4Plus !== 2 || alerts.bopSites !== 1 || alerts.teethRecorded !== 2) {
  console.error("countPerioAlerts mismatch", alerts)
  failed += 1
}

// Snapshot extract shape used by audit restore UI (kind + data wrapper)
const auditAfter = { kind: "periodontal", data: stored }
if (auditAfter.kind !== "periodontal" || countPerioAlerts(auditAfter.data).teethRecorded !== 2) {
  console.error("audit snapshot shape invalid")
  failed += 1
}

// Print honesty: empty chart must not fabricate teeth
if (countPerioAlerts(emptyPeriodontalChart()).teethRecorded !== 0) {
  console.error("print honesty: empty chart must stay empty")
  failed += 1
}

if (failed > 0) {
  console.error(`verify-periodontal-types: ${failed} failure(s)`)
  process.exit(1)
}
console.log("verify-periodontal-types: ok")
