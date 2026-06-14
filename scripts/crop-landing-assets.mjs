import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"

const SOURCE = path.resolve("yeni screenshoot ve mp4")
const OUT = path.join(SOURCE, "landing-ready")

const SKIP_CROP_PATTERNS = [
  /kiosk/i,
  /external screen/i,
  /portal video/i,
  /claims data/i,
  /concent sample/i,
  /invoice detail printout/i,
  /bordro/i,
]

function deviceBucket(width, filename) {
  if (/mobile|mobil/i.test(filename)) return "mobile"
  if (/tablet/i.test(filename)) return "tablet"
  if (/web/i.test(filename)) return "web"
  if (width < 500) return "mobile"
  if (width < 1000) return "tablet"
  return "web"
}

function cropTopPx(width, filename) {
  if (SKIP_CROP_PATTERNS.some((re) => re.test(filename))) return 0
  if (width < 500) return 58
  if (width < 1000) return 62
  return 72
}

async function processImage(file) {
  const src = path.join(SOURCE, file)
  const meta = await sharp(src).metadata()
  const crop = cropTopPx(meta.width ?? 0, file)
  const bucket = deviceBucket(meta.width ?? 0, file)
  const outDir = path.join(OUT, bucket)
  fs.mkdirSync(outDir, { recursive: true })

  const outPath = path.join(outDir, file.replace(/\.jpe?g$/i, ".jpg"))
  const pipeline = sharp(src)
  if (crop > 0 && (meta.height ?? 0) > crop + 80) {
    await pipeline
      .extract({ left: 0, top: crop, width: meta.width, height: meta.height - crop })
      .toFile(outPath)
  } else {
    await pipeline.toFile(outPath)
  }

  return { file, bucket, crop, size: `${meta.width}x${meta.height}` }
}

async function copyVideo(file) {
  const outDir = path.join(OUT, "videos")
  fs.mkdirSync(outDir, { recursive: true })
  fs.copyFileSync(path.join(SOURCE, file), path.join(outDir, file))
  return { file, bucket: "videos", crop: 0 }
}

async function main() {
  const entries = fs.readdirSync(SOURCE)
  const images = entries.filter((f) => /\.(png|jpe?g)$/i.test(f))
  const videos = entries.filter((f) => /\.mp4$/i.test(f))

  const results = []
  for (const file of images) {
    results.push(await processImage(file))
  }
  for (const file of videos) {
    results.push(await copyVideo(file))
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: SOURCE,
    output: OUT,
    note: "Top crop removes dashboard topbar (name/initials). Kiosk, TV external, printouts skipped.",
    items: results,
  }

  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2))

  console.log(`Processed ${results.length} files -> ${OUT}`)
  const byBucket = results.reduce((acc, r) => {
    acc[r.bucket] = (acc[r.bucket] ?? 0) + 1
    return acc
  }, {})
  console.log(byBucket)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
