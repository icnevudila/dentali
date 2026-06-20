import { messagesEnPh, messagesTr } from "../src/lib/i18n/messages"

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

const en = flatten(messagesEnPh)
const tr = flatten(messagesTr)
const missing = Object.entries(en).filter(([key]) => !(key in tr))
const extra = Object.keys(tr).filter((key) => !(key in en))

console.log("EN keys:", Object.keys(en).length)
console.log("TR keys:", Object.keys(tr).length)
console.log("Missing in TR:", missing.length)
console.log("Extra TR-only keys:", extra.length)

if (missing.length) {
  missing.slice(0, 60).forEach(([key, value]) => console.log(`${key} => ${value.slice(0, 100)}`))
  process.exitCode = 1
}
