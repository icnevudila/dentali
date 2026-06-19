import fs from "node:fs"
import path from "node:path"
import { enFlat } from "./flatten-code-messages.mjs"

const batchPath = path.join(process.cwd(), "scripts/phrase-tr-batch.json")
const phrasePath = path.join(process.cwd(), "scripts/phrase-tr-by-key.json")

if (!fs.existsSync(batchPath)) {
  console.error("Missing scripts/phrase-tr-batch.json")
  process.exit(1)
}

const batch = JSON.parse(fs.readFileSync(batchPath, "utf8"))
const phrase = JSON.parse(fs.readFileSync(phrasePath, "utf8"))
Object.assign(phrase, batch)
fs.writeFileSync(phrasePath, JSON.stringify(phrase, null, 2))

const missing = Object.keys(enFlat).filter((k) => !phrase[k])
console.log(`phrase-tr-by-key: ${Object.keys(phrase).length} keys, still missing: ${missing.length}`)
if (missing.length) {
  console.log("First missing:", missing.slice(0, 10).join(", "))
  process.exit(1)
}
