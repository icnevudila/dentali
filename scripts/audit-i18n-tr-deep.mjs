import { messagesEnPh, messagesTr } from "../src/lib/i18n/messages.ts"
import { marketingMessagesEn, marketingMessagesTr } from "../src/lib/i18n/marketing-messages.ts"
import { mergeMessageTrees } from "../src/lib/i18n/marketing-messages.ts"

function flatten(tree, prefix = "") {
  const out = {}
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === "string") out[path] = value
    else Object.assign(out, flatten(value, path))
  }
  return out
}

const enMerged = flatten(mergeMessageTrees(messagesEnPh, marketingMessagesEn))
const trMerged = flatten(mergeMessageTrees(messagesTr, marketingMessagesTr))

let missing = 0
let sameAsEn = 0
let suspicious = 0
const missingList = []
const sameList = []
const suspiciousList = []

for (const [key, enVal] of Object.entries(enMerged)) {
  const trVal = trMerged[key]
  if (!trVal) {
    missing++
    missingList.push({ key, en: enVal })
  } else if (trVal === enVal) {
    sameAsEn++
    sameList.push({ key, en: enVal })
  } else if (/^[A-Za-z0-9\s.,!?'"()\-–—:;/₱$%&]+$/.test(trVal) && /[a-z]/.test(trVal)) {
    // mostly ASCII latin = likely untranslated or regex fallback quality
    const enWords = enVal.toLowerCase().split(/\s+/)
    const trWords = trVal.toLowerCase().split(/\s+/)
    const overlap = enWords.filter((w) => trWords.includes(w) && w.length > 3).length
    if (overlap >= Math.min(2, enWords.length)) {
      suspicious++
      suspiciousList.push({ key, en: enVal, tr: trVal })
    }
  }
}

console.log("Merged EN keys:", Object.keys(enMerged).length)
console.log("Merged TR keys:", Object.keys(trMerged).length)
console.log("Missing in TR:", missing)
console.log("Same as EN:", sameAsEn)
console.log("Suspicious (mostly English words):", suspicious)

if (missingList.length) {
  console.log("\n--- Missing (first 30) ---")
  missingList.slice(0, 30).forEach(({ key, en }) => console.log(key))
}

if (suspiciousList.length) {
  console.log("\n--- Suspicious TR (first 50) ---")
  suspiciousList.slice(0, 50).forEach(({ key, en, tr }) =>
    console.log(`${key}\n  EN: ${en}\n  TR: ${tr}\n`)
  )
}
