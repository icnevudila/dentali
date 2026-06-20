import { getMessages } from "../src/lib/i18n/messages"

type FlatMessages = Record<string, string>

function flatten(tree: Record<string, unknown>, prefix = ""): FlatMessages {
  const out: FlatMessages = {}
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === "string") out[path] = value
    else if (value && typeof value === "object") Object.assign(out, flatten(value as Record<string, unknown>, path))
  }
  return out
}

const en = flatten(getMessages("en"))
const tr = flatten(getMessages("tr"))
const allowedSame = /^(PRC|HMO|PhilHealth(?: eClaims| ID)?|SMS(?: \(Semaphore\))?|WhatsApp|SKU|GCash|PHP|PDF|CSV|API|URL|Email|Blog|Kiosk|Portal|Lab|BOM|Starter|Growth|Enterprise)$/i
const englishWord = /\b(the|and|for|with|from|your|this|that|before|after|please|click|showing|required)\b/i
const missing: string[] = []
const untranslated: string[] = []
const suspicious: string[] = []

for (const [key, english] of Object.entries(en)) {
  const turkish = tr[key]
  if (!turkish) missing.push(key)
  else if (turkish === english && !allowedSame.test(english.trim())) untranslated.push(key)
  else if (englishWord.test(turkish)) suspicious.push(key)
}

console.log("Total keys:", Object.keys(en).length)
console.log("Missing TR:", missing.length)
console.log("Untranslated TR:", untranslated.length)
console.log("Suspicious hybrid TR:", suspicious.length)

if (missing.length || untranslated.length || suspicious.length) {
  for (const key of [...missing, ...untranslated, ...suspicious].slice(0, 80)) {
    console.log(`${key} => ${tr[key] ?? "<missing>"}`)
  }
  process.exitCode = 1
}
