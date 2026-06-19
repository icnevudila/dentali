import { codeMessagesEn } from "../src/lib/i18n/code-messages.ts"
import { messagesTr } from "../src/lib/i18n/messages.ts"
import { codeMessagesTrOverrides } from "../src/lib/i18n/code-messages-tr-overrides.ts"
import { translateMissingFallback } from "../src/lib/i18n/fallback-translations.ts"
import { getMessages } from "../src/lib/i18n/messages.ts"

function flatten(tree, prefix = "") {
  const out = {}
  for (const [key, value] of Object.entries(tree)) {
    const p = prefix ? `${prefix}.${key}` : key
    if (typeof value === "string") out[p] = value
    else Object.assign(out, flatten(value, p))
  }
  return out
}

const enCode = flatten(codeMessagesEn)
const trMsg = flatten(messagesTr)
const trOverrides = flatten(codeMessagesTrOverrides)
const trMerged = flatten(getMessages("tr"))

const englishWordRe = /\b(the|and|for|with|from|your|this|that|before|after|please|click|open|select|showing|need|required|patient|appointment|billing)\b/i
const properNounOnly = /^(PhilHealth|HMO|SMS|OK|Blog|SKU|Kiosk|Portal|Global|PDA|Queue|Check-in|Chart|SEO|CSV|PDF|PHP|₱)$/i

let bad = 0
const badList = []

for (const [key, en] of Object.entries(enCode)) {
  const tr = trMerged[key]
  if (!tr || tr === en) {
    if (!properNounOnly.test(en) && en.length > 2) badList.push({ key, en, tr, reason: "same" })
  } else if (englishWordRe.test(tr) && /[a-zA-Z]{4,}/.test(tr)) {
    badList.push({ key, en, tr, reason: "hybrid" })
  }
}

console.log("code-messages keys:", Object.keys(enCode).length)
console.log("Bad TR for code keys:", badList.length)
console.log("Hybrid samples:", badList.filter((b) => b.reason === "hybrid").slice(0, 15))
console.log("Same as EN samples:", badList.filter((b) => b.reason === "same").slice(0, 15))
