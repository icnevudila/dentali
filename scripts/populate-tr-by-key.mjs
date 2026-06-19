/**
 * Builds scripts/tr-by-key.json — keyed TR for every code-messages EN string.
 * Sources: messagesTr (same key), overrides, TR_EXACT, then hand-tuned PHRASE_TR.
 *
 * Run: node scripts/populate-tr-by-key.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { enFlat, trFlat } from "./flatten-code-messages.mjs"
import { messagesEnPh, messagesTr } from "../src/lib/i18n/messages.ts"
import { codeMessagesTrOverrides } from "../src/lib/i18n/code-messages-tr-overrides.ts"
import { TR_EXACT_EXPORT } from "../src/lib/i18n/fallback-translations.ts"

function flatten(tree, prefix = "") {
  const out = {}
  for (const [key, value] of Object.entries(tree)) {
    const p = prefix ? `${prefix}.${key}` : key
    if (typeof value === "string") out[p] = value
    else Object.assign(out, flatten(value, p))
  }
  return out
}

function isHybridTr(text) {
  if (!/[ğüşıöçĞÜŞİÖÇ]/.test(text)) return false
  return /\b(the|and|for|with|from|who|which|this|that|before|after|without|showing|review|use|read|open|select|need|your|remains|posted|is|are|was|were|has|have|had|will|would|should|could|can|may|might|must|been|being|does|did|done|make|made|get|got|see|seen|know|think|want|go|come|take|give|find|tell|ask|work|try|leave|call|keep|let|begin|seem|help|show|hear|play|run|move|live|believe|bring|happen|write|provide|sit|stand|lose|pay|meet|include|continue|set|learn|change|lead|understand|watch|follow|stop|create|speak|read|allow|add|spend|grow|open|walk|win|offer|remember|love|consider|appear|buy|wait|serve|die|send|expect|build|stay|fall|cut|reach|kill|remain|pick|busiest|quick|volume|pattern|sensitive|sandbox|prepare|return|configure|schedule|provider|checking|peak|booked|slots|leakage|utilization|activity|daily|discount|apply)\b/i.test(
    text
  )
}

function isProperNoun(en) {
  const t = en.trim()
  if (t.length <= 3 && /^[A-Z0-9₱]+$/.test(t)) return true
  if (/^(PhilHealth|HMO|SMS|OK|Blog|SKU|Kiosk|Portal|Global|PDA|Queue|Chart|SEO|CSV|PDF|PHP|₱|dry-run|Self-pay|PayMongo|PAYMONGO_SECRET_KEY|WhatsApp|Ortho|Check-in|Waiting)$/i.test(t))
    return true
  if (/^\{[a-zA-Z0-9_]+\}/.test(t)) return false
  return false
}

/** Full-string translations for code-messages (key → TR). Grows over time. */
const PHRASE_TR = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "scripts/phrase-tr-by-key.json"), "utf8")
)

const enMsg = flatten(messagesEnPh)
const trMsg = flatten(messagesTr)
const overrides = flatten(codeMessagesTrOverrides)

const out = {}
let fromPhrase = 0
let fromExact = 0
let fromMsg = 0
let fromOverride = 0
let fromExisting = 0
let stillEnglish = 0

for (const [key, en] of Object.entries(enFlat)) {
  if (overrides[key]) {
    out[key] = overrides[key]
    fromOverride++
    continue
  }
  if (PHRASE_TR[key]) {
    out[key] = PHRASE_TR[key]
    fromPhrase++
    continue
  }
  if (key in enMsg && trMsg[key] && trMsg[key] !== en && !isHybridTr(trMsg[key])) {
    out[key] = trMsg[key]
    fromMsg++
    continue
  }
  if (TR_EXACT_EXPORT[en] && TR_EXACT_EXPORT[en] !== en) {
    out[key] = TR_EXACT_EXPORT[en]
    fromExact++
    continue
  }
  const existing = trFlat[key]
  if (existing && existing !== en && !isHybridTr(existing) && !isProperNoun(en)) {
    out[key] = existing
    fromExisting++
    continue
  }
  if (isProperNoun(en)) {
    out[key] = en
    continue
  }
  out[key] = en
  stillEnglish++
}

// Merge phrase-tr-by-key into tr-by-key for sync/build pipeline
const phrasePath = path.join(process.cwd(), "scripts/phrase-tr-by-key.json")
if (fs.existsSync(phrasePath)) {
  const phrase = JSON.parse(fs.readFileSync(phrasePath, "utf8"))
  Object.assign(out, phrase)
}

const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)))
fs.writeFileSync(
  path.join(process.cwd(), "scripts/tr-by-key.json"),
  JSON.stringify(sorted, null, 2),
  "utf8"
)

console.log(`tr-by-key.json: ${Object.keys(sorted).length} keys`)
console.log(`  override: ${fromOverride}, phrase: ${fromPhrase}, messages: ${fromMsg}, exact: ${fromExact}, kept-good: ${fromExisting}`)
console.log(`  still English (need phrase-tr): ${stillEnglish}`)
