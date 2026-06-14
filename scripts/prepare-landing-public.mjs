/**
 * Full-page screenshots → landing-ready viewport crops for public/landing.
 * Crops app topbar (user name + branch chip) from staff UI shots.
 */
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"

const SOURCE = path.resolve("yeni screenshoot ve mp4")
const OUT = path.resolve("public/landing")

/** @type {{ out: string, file: string, aspect: number, focalY?: number, skipTopCrop?: boolean }[]} */
const ASSETS = [
  // Hero slideshow (desktop 16:10)
  { out: "hero-dashboard.png", file: "dashboard full web.png", aspect: 16 / 10, focalY: 0 },
  { out: "hero-dental-chart.png", file: "dental chart.png", aspect: 16 / 10, focalY: 0, skipTopCrop: true },
  { out: "hero-appointments.png", file: "appointmens web 2.png", aspect: 16 / 10, focalY: 560 },
  { out: "hero-queue.png", file: "QueQue web.png", aspect: 16 / 10, focalY: 0 },

  // Features (reuse hero crops)
  { out: "feature-dashboard.png", file: "dashboard full web.png", aspect: 16 / 10, focalY: 0 },
  { out: "feature-patients.png", file: "patinets full web.png", aspect: 16 / 7, focalY: 0 },
  { out: "feature-dental-chart.png", file: "dental chart.png", aspect: 16 / 10, focalY: 0, skipTopCrop: true },
  { out: "feature-treatment.png", file: "patient detail web.png", aspect: 16 / 10, focalY: 0 },
  { out: "feature-appointments.png", file: "appointmens web 2.png", aspect: 16 / 10, focalY: 560 },
  { out: "feature-queue.png", file: "QueQue web.png", aspect: 16 / 10, focalY: 0 },
  { out: "feature-billing.png", file: "invoices detail.png", aspect: 16 / 10, focalY: 0 },
  { out: "feature-inventory.png", file: "inventory web.png", aspect: 16 / 10, focalY: 0 },
  { out: "feature-reports.png", file: "reports full web.png", aspect: 16 / 10, focalY: 0 },
  { out: "feature-staff.png", file: "settings sample.png", aspect: 16 / 10, focalY: 0 },

  { out: "problem-dashboard.png", file: "dashboard full web.png", aspect: 16 / 10, focalY: 120 },

  // Multi-device
  { out: "device-desktop-dashboard.png", file: "dashboard full web.png", aspect: 16 / 10, focalY: 0 },
  { out: "device-tablet-kiosk.png", file: "kiosk web.png", aspect: 4 / 3, focalY: 0, skipTopCrop: true },
  { out: "device-mobile-appointments.png", file: "appointments mobile.png", aspect: 9 / 19, focalY: 0 },

  // Day in clinic timeline
  { out: "timeline-dashboard.png", file: "dashboard full web.png", aspect: 16 / 10, focalY: 0 },
  { out: "timeline-kiosk.png", file: "kiosk web.png", aspect: 4 / 3, focalY: 0, skipTopCrop: true },
  { out: "timeline-patient.png", file: "patient detail web.png", aspect: 16 / 10, focalY: 0 },
  { out: "timeline-chart.png", file: "dental chart web.png", aspect: 16 / 10, focalY: 520 },
  { out: "timeline-tv-queue.png", file: "queque web external screen.png", aspect: 16 / 10, focalY: 0, skipTopCrop: true },
  { out: "timeline-billing.png", file: "invoices detail.png", aspect: 16 / 10, focalY: 0 },
  { out: "timeline-inventory.png", file: "inventory web.png", aspect: 16 / 10, focalY: 0 },
  { out: "timeline-reports.png", file: "reports full web.png", aspect: 16 / 10, focalY: 0 },
]

const SKIP_TOP_CROP = [/kiosk/i, /external screen/i]

function shouldSkipTopCrop(filename) {
  return SKIP_TOP_CROP.some((re) => re.test(filename))
}

function topCropPx(width, filename, skipTopCrop) {
  if (skipTopCrop || shouldSkipTopCrop(filename)) return 0
  const topbarAt1440 = 88
  let crop = Math.round(topbarAt1440 * (width / 1440))
  // Phone captures include a taller header row (menu, branch, avatar)
  if (width < 600 || /mobile/i.test(filename)) {
    crop = Math.max(crop, Math.round(96 * (width / 430)))
  }
  return crop
}

async function cropViewport(srcPath, { aspect, focalY = 0, skipTopCrop = false }) {
  const meta = await sharp(srcPath).metadata()
  const w = meta.width ?? 0
  const h = meta.height ?? 0
  const top = topCropPx(w, path.basename(srcPath), skipTopCrop)
  const availH = h - top
  const cropH = Math.min(Math.round(w / aspect), availH)
  const maxY = Math.max(0, availH - cropH)
  const y = top + Math.min(focalY, maxY)

  return sharp(srcPath).extract({
    left: 0,
    top: y,
    width: w,
    height: cropH,
  })
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const manifest = []

  for (const asset of ASSETS) {
    const src = path.join(SOURCE, asset.file)
    if (!fs.existsSync(src)) {
      console.warn(`SKIP missing: ${asset.file}`)
      continue
    }

    const outPath = path.join(OUT, asset.out)
    const pipeline = await cropViewport(src, asset)
    const meta = await pipeline.metadata()
    await pipeline
      .resize({ width: Math.min(meta.width ?? 1440, 1440), withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toFile(outPath)

    manifest.push({
      out: asset.out,
      source: asset.file,
      aspect: asset.aspect,
      focalY: asset.focalY ?? 0,
      outputSize: `${meta.width}x${meta.height}`,
    })
    console.log(`OK ${asset.out}`)
  }

  // Videos — copy from landing-ready/videos
  const videoDir = path.join(OUT, "videos")
  const videoSourceDir = path.join(SOURCE, "landing-ready", "videos")
  fs.mkdirSync(videoDir, { recursive: true })
  for (const v of ["kiosk video.mp4", "patient portal video.mp4"]) {
    const src = path.join(videoSourceDir, v)
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(videoDir, v.replace(/\s+/g, "-")))
      console.log(`OK videos/${v.replace(/\s+/g, "-")}`)
    } else {
      console.warn(`SKIP missing video: ${src}`)
    }
  }

  fs.writeFileSync(
    path.join(OUT, "manifest.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        note: "Viewport crops from full-page screenshots. Staff UI crops topbar (no user/branch chip). focalY scrolls to key UI.",
        items: manifest,
      },
      null,
      2
    )
  )
  console.log(`\n${manifest.length} images → ${OUT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
