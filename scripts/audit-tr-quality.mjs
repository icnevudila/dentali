import { getMessages } from "../src/lib/i18n/messages.ts"

const en = getMessages("en")
const tr = getMessages("tr")

function flatten(tree, prefix = "") {
  const out = {}
  for (const [key, value] of Object.entries(tree)) {
    const p = prefix ? `${prefix}.${key}` : key
    if (typeof value === "string") out[p] = value
    else Object.assign(out, flatten(value, p))
  }
  return out
}

const enFlat = flatten(en)
const trFlat = flatten(tr)

const sameAsEn = []
const suspicious = []
const missingTr = []

const englishWordRe = /\b(the|and|for|with|from|your|this|that|before|after|please|click|open|select|showing|need|required)\b/i

for (const [key, enVal] of Object.entries(enFlat)) {
  const trVal = trFlat[key]
  if (!trVal) {
    missingTr.push({ key, en: enVal })
    continue
  }
  if (trVal === enVal) sameAsEn.push({ key, en: enVal })
  else if (englishWordRe.test(trVal) && /[a-zA-Z]{4,}/.test(trVal)) {
    suspicious.push({ key, en: enVal, tr: trVal })
  }
}

console.log("Total keys:", Object.keys(enFlat).length)
console.log("Missing TR:", missingTr.length)
console.log("TR identical to EN:", sameAsEn.length)
console.log("Suspicious TR (English words):", suspicious.length)

console.log("\n--- Same as EN (first 40) ---")
sameAsEn.slice(0, 40).forEach(({ key, en }) => console.log(key, "|", en.slice(0, 70)))

console.log("\n--- Suspicious (first 60) ---")
suspicious.slice(0, 60).forEach(({ key, tr }) => console.log(key, "|", tr.slice(0, 90)))
