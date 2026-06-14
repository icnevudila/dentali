import fs from "node:fs"

const path = "src/components/landing/data/landing-data.ts"
let s = fs.readFileSync(path, "utf8")

if (!s.includes('from "./landing-assets"')) {
  s = s.replace(
    'from "lucide-react"\n',
    'from "lucide-react"\nimport { landingAsset as asset } from "./landing-assets"\n'
  )
}

s = s.replace(/"(\/landing\/[^"]+)"/g, 'asset("$1")')

fs.writeFileSync(path, s)
console.log("patched", path)
