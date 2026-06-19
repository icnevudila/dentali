/**
 * Export English UI strings that need Turkish translations.
 * Run: npx tsx scripts/export-en-for-tr.mjs
 */
import fs from "node:fs"
import { getMessages } from "../src/lib/i18n/messages.ts"
import { codeMessagesEn } from "../src/lib/i18n/code-messages.ts"
import { TR_EXACT } from "../src/lib/i18n/tr-exact-export.ts"

function flatten(tree, prefix = "") {
  const out = {}
  for (const [key, value] of Object.entries(tree)) {
    const p = prefix ? `${prefix}.${key}` : key
    if (typeof value === "string") out[p] = value
    else Object.assign(out, flatten(value, p))
  }
  return out
}

const enMerged = flatten(getMessages("en"))
const trMerged = flatten(getMessages("tr"))
const enCode = flatten(codeMessagesEn)

const needs = []
const seen = new Set()

for (const [key, en] of Object.entries({ ...enMerged, ...enCode })) {
  if (seen.has(en)) continue
  seen.add(en)
  const tr = trMerged[key]
  if (TR_EXACT[en]) continue
  if (tr && tr !== en && !/[ğüşıöç]/.test(tr) && !/\b(the|and|for|with|from|who|which)\b/i.test(tr)) continue
  if (tr && tr !== en && /[ğüşıöç]/.test(tr) && !/\b(the|and|for|with|from|who|which)\b/i.test(tr)) continue
  if (/^[A-Z0-9 .,/₱%&–—:;!?'"()\-]+$/.test(en) && en.length < 4) continue
  needs.push({ key, en })
}

const outPath = "scripts/tr-pending.json"
fs.writeFileSync(outPath, JSON.stringify(needs, null, 2), "utf8")
console.log(`Exported ${needs.length} strings to ${outPath}`)
