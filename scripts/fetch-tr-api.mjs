/**
 * Fetches Turkish translations for unique EN strings via MyMemory (free, rate-limited).
 * Run: node scripts/fetch-tr-api.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { enFlat } from "./flatten-code-messages.mjs"

const phrasePath = path.join(process.cwd(), "scripts/phrase-tr-by-key.json")
const existing = fs.existsSync(phrasePath)
  ? JSON.parse(fs.readFileSync(phrasePath, "utf8"))
  : {}

const needs = Object.entries(enFlat)
  .filter(([k]) => !existing[k])
  .map(([k, en]) => ({ k, en }))

const uniqueEn = [...new Set(needs.map((x) => x.en))]
const toFetch = uniqueEn.filter((en) => {
  const keys = needs.filter((x) => x.en === en).map((x) => x.k)
  return keys.some((k) => !existing[k])
})

console.log(`Fetching ${toFetch.length} unique EN strings…`)

const enToTr = JSON.parse(
  fs.existsSync("scripts/en-to-tr-api.json")
    ? fs.readFileSync("scripts/en-to-tr-api.json", "utf8")
    : "{}"
)

async function translate(en) {
  if (enToTr[en]) return enToTr[en]
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(en)}&langpair=en|tr`
  const res = await fetch(url)
  const data = await res.json()
  if (data.responseStatus !== 200) throw new Error(data.responseDetails || "API error")
  const tr = data.responseData.translatedText
  enToTr[en] = tr
  return tr
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

let done = 0
for (const en of toFetch) {
  if (enToTr[en]) {
    done++
    continue
  }
  try {
    await translate(en)
    done++
    if (done % 10 === 0) {
      fs.writeFileSync("scripts/en-to-tr-api.json", JSON.stringify(enToTr, null, 2))
      console.log(`  ${done}/${toFetch.length}`)
    }
    await sleep(350)
  } catch (e) {
    console.error("Failed:", en.slice(0, 60), e.message)
    await sleep(2000)
  }
}

fs.writeFileSync("scripts/en-to-tr-api.json", JSON.stringify(enToTr, null, 2))

const phrase = { ...existing }
for (const { k, en } of needs) {
  if (phrase[k]) continue
  const tr = enToTr[en]
  if (tr) phrase[k] = tr
}

fs.writeFileSync("scripts/phrase-tr-by-key.json", JSON.stringify(phrase, null, 2))
console.log(`phrase-tr-by-key.json: ${Object.keys(phrase).length} keys`)
