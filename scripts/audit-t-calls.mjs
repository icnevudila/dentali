import fs from "node:fs"
import path from "node:path"
import { messagesEnPh, messagesTr } from "../src/lib/i18n/messages.ts"

function flatten(tree, prefix = "") {
  const out = {}
  for (const [key, value] of Object.entries(tree)) {
    const p = prefix ? `${prefix}.${key}` : key
    if (typeof value === "string") out[p] = value
    else Object.assign(out, flatten(value, p))
  }
  return out
}

const en = flatten(messagesEnPh)
const tr = flatten(messagesTr)

const srcRoot = path.join(process.cwd(), "src")
const tCallRe = /\bt\(\s*["'`]([^"'`]+)["'`]\s*,\s*["'`]((?:\\.|[^"'`])*)["'`]/g

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) {
      if (name !== "node_modules") walk(full, files)
    } else if (/\.(tsx?|jsx?)$/.test(name)) files.push(full)
  }
  return files
}

const used = new Map()
for (const file of walk(srcRoot)) {
  const text = fs.readFileSync(file, "utf8")
  let m
  while ((m = tCallRe.exec(text))) {
    const key = m[1]
    const fallback = m[2].replace(/\\'/g, "'").replace(/\\"/g, '"')
    if (!used.has(key)) used.set(key, { fallback, files: [file] })
    else used.get(key).files.push(file)
  }
}

const missingInEn = []
const missingInTr = []
const trUsesFallbackOnly = []

for (const [key, { fallback }] of used) {
  if (!(key in en)) missingInEn.push({ key, fallback })
  if (!(key in tr)) missingInTr.push({ key, fallback })
}

console.log("Unique t() keys in codebase:", used.size)
console.log("Missing in messagesEnPh:", missingInEn.length)
console.log("Missing in messagesTr:", missingInTr.length)

if (missingInEn.length) {
  console.log("\n--- Missing in EN (first 60) ---")
  for (const { key, fallback } of missingInEn.slice(0, 60)) {
    console.log(`${key} => ${fallback.slice(0, 70)}`)
  }
}

if (missingInTr.length) {
  console.log("\n--- Missing in TR (first 60) ---")
  for (const { key, fallback } of missingInTr.slice(0, 60)) {
    console.log(`${key} => ${fallback.slice(0, 70)}`)
  }
}
