/**
 * Fast flatten of code-messages EN/TR without tsx import graph.
 */
import fs from "node:fs"
import path from "node:path"

const filePath = path.join(process.cwd(), "src/lib/i18n/code-messages.ts")
const src = fs.readFileSync(filePath, "utf8")

function parseTree(exportName) {
  const marker = `export const ${exportName}`
  const start = src.indexOf(marker)
  if (start < 0) throw new Error(`Missing ${exportName}`)
  const eq = src.indexOf("=", start)
  let i = src.indexOf("{", eq)
  let depth = 0
  const begin = i
  let inString = false
  let quote = ""
  let escaped = false

  for (; i < src.length; i++) {
    const ch = src[i]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === "\\") {
        escaped = true
        continue
      }
      if (ch === quote) inString = false
      continue
    }

    if (ch === '"' || ch === "'") {
      inString = true
      quote = ch
      continue
    }

    if (ch === "{") depth++
    else if (ch === "}") {
      depth--
      if (depth === 0) {
        const body = src.slice(begin, i + 1)
        // eslint-disable-next-line no-new-func
        return new Function(`return ${body}`)()
      }
    }
  }
  throw new Error(`Unclosed tree for ${exportName}`)
}

function flatten(tree, prefix = "") {
  const out = {}
  for (const [key, value] of Object.entries(tree)) {
    const p = prefix ? `${prefix}.${key}` : key
    if (typeof value === "string") out[p] = value
    else Object.assign(out, flatten(value, p))
  }
  return out
}

const enTree = parseTree("codeMessagesEn")
const trTree = parseTree("codeMessagesTr")

export const enFlat = flatten(enTree)
export const trFlat = flatten(trTree)
