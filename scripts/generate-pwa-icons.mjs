import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const svgPath = join(root, "public/icons/icon.svg")
const svg = readFileSync(svgPath)

const sizes = [192, 512]
for (const size of sizes) {
  const out = join(root, `public/icons/icon-${size}.png`)
  await sharp(svg, { density: 300 }).resize(size, size).png().toFile(out)
  console.log(`Wrote ${out}`)
}
