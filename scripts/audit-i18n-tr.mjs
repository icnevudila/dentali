import { messagesEnPh, messagesTr } from "../src/lib/i18n/messages.ts"

function flatten(tree, prefix = "") {
  const out = {}
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === "string") out[path] = value
    else Object.assign(out, flatten(value, path))
  }
  return out
}

const en = flatten(messagesEnPh)
const tr = flatten(messagesTr)
const missing = []
const sameAsEn = []

for (const [key, enVal] of Object.entries(en)) {
  if (!(key in tr)) missing.push({ key, en: enVal })
  else if (tr[key] === enVal) sameAsEn.push({ key, en: enVal })
}

const extraTr = Object.keys(tr).filter((k) => !(k in en))

console.log("EN keys:", Object.keys(en).length)
console.log("TR keys:", Object.keys(tr).length)
console.log("Missing in TR:", missing.length)
console.log("TR same as EN (untranslated):", sameAsEn.length)
console.log("Extra TR-only keys:", extraTr.length)

if (missing.length) {
  console.log("\n--- First 40 missing ---")
  missing.slice(0, 40).forEach(({ key, en }) => console.log(key, "=>", en.slice(0, 80)))
}

if (sameAsEn.length) {
  console.log("\n--- First 40 untranslated (same as EN) ---")
  sameAsEn.slice(0, 40).forEach(({ key, en }) => console.log(key, "=>", en.slice(0, 80)))
}
