import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const root = process.cwd()
const srcDir = join(root, "src")
const patterns = [
  ["router navigation", /\brouter\.(push|replace)\s*\(/g],
  ["link href", /<Link\b[^>]*\bhref=/g],
  ["click action", /\bonClick=/g],
  ["rpc call", /\.rpc\s*\(/g],
  ["table insert", /\.from\s*\([^)]*\)\s*[\s\S]{0,120}\.insert\s*\(/g],
  ["table update", /\.from\s*\([^)]*\)\s*[\s\S]{0,120}\.update\s*\(/g],
  ["table delete", /\.from\s*\([^)]*\)\s*[\s\S]{0,120}\.delete\s*\(/g],
  ["table upsert", /\.from\s*\([^)]*\)\s*[\s\S]{0,120}\.upsert\s*\(/g],
]

const files = []

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue
    const path = join(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) walk(path)
    else if (/\.(ts|tsx|js|jsx)$/.test(entry)) files.push(path)
  }
}

walk(srcDir)

const report = []
for (const file of files) {
  const text = readFileSync(file, "utf8")
  const hits = {}
  for (const [label, regex] of patterns) {
    regex.lastIndex = 0
    const count = [...text.matchAll(regex)].length
    if (count > 0) hits[label] = count
  }
  if (Object.keys(hits).length > 0) {
    report.push({ file: relative(root, file).replaceAll("\\", "/"), hits })
  }
}

report.sort((a, b) => {
  const weight = (item) =>
    Object.entries(item.hits).reduce((sum, [label, count]) => {
      const multiplier = label.startsWith("table") ? 4 : label === "rpc call" ? 2 : 1
      return sum + count * multiplier
    }, 0)
  return weight(b) - weight(a)
})

console.log(JSON.stringify({ generated_at: new Date().toISOString(), files: report }, null, 2))
