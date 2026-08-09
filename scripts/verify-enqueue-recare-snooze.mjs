/**
 * Ensures the latest enqueue_hygiene_recalls migration excludes active snoozes
 * with Asia/Manila today (same rule as list/count). No network / no PHI.
 *
 * Run: node scripts/verify-enqueue-recare-snooze.mjs
 */
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

const migrationsDir = join(process.cwd(), "supabase", "migrations")
const files = readdirSync(migrationsDir)
  .filter((f) => /^\d{14}_.+\.sql$/i.test(f))
  .sort()

let latestEnqueueFile = null
let latestEnqueueSql = ""

for (const file of files) {
  const sql = readFileSync(join(migrationsDir, file), "utf8")
  if (
    /create\s+or\s+replace\s+function\s+public\.enqueue_hygiene_recalls\s*\(/i.test(
      sql,
    )
  ) {
    latestEnqueueFile = file
    latestEnqueueSql = sql
  }
}

let failed = 0

if (!latestEnqueueFile) {
  console.error("enqueue_hygiene_recalls definition not found in migrations")
  failed += 1
} else {
  if (latestEnqueueFile < "20260809120000") {
    console.error(
      `Latest enqueue redefine (${latestEnqueueFile}) must be after 20260809120000`,
    )
    failed += 1
  }

  if (
    !/recare_snoozed_until\s+is\s+null\s+or\s+pbl\.recare_snoozed_until\s*<\s*v_today/i.test(
      latestEnqueueSql,
    )
  ) {
    console.error(
      `Latest enqueue_hygiene_recalls (${latestEnqueueFile}) missing snooze exclusion`,
    )
    failed += 1
  }

  if (
    !/v_today\s+date\s*:=\s*\(\s*now\(\)\s+at\s+time\s+zone\s+'Asia\/Manila'\s*\)::date/i.test(
      latestEnqueueSql,
    )
  ) {
    console.error(
      `Latest enqueue_hygiene_recalls (${latestEnqueueFile}) missing Asia/Manila v_today`,
    )
    failed += 1
  }
}

if (failed > 0) {
  console.error(`verify-enqueue-recare-snooze: ${failed} failure(s)`)
  process.exit(1)
}

console.log(`verify-enqueue-recare-snooze: ok (${latestEnqueueFile})`)
