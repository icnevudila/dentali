import fs from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

const SOURCE = path.resolve(
  ".codex-remote-attachments/019ed789-8fe9-7661-ba3d-30a4c2e2d76c/644983fc-54b3-44d2-81ce-bc0c83444a22/1-Photo-1.jpg"
)
const OUT_DIR = path.resolve("public/branding/prescription")

/** Tuned for Del Rosario · Guevarra pad (576×1280 phone photo with UI chrome). */
const CROP = {
  /** Strip messenger/status bar above the pad */
  trimTopRatio: 0.095,
  /** Strip phone nav / keyboard below the pad */
  trimBottomRatio: 0.19,
  headerRatio: 0.355,
  footerRatio: 0.185,
  watermarkRatio: 0.42,
}

async function main() {
  const image = sharp(SOURCE)
  const meta = await image.metadata()
  const width = meta.width ?? 576
  const height = meta.height ?? 1280

  const trimTop = Math.round(height * CROP.trimTopRatio)
  const trimBottom = Math.round(height * CROP.trimBottomRatio)
  const padHeight = Math.max(1, height - trimTop - trimBottom)

  const headerHeight = Math.max(1, Math.round(padHeight * CROP.headerRatio))
  const footerHeight = Math.max(1, Math.round(padHeight * CROP.footerRatio))
  const bodyTop = trimTop + headerHeight
  const bodyHeight = Math.max(1, padHeight - headerHeight - footerHeight)

  await fs.mkdir(OUT_DIR, { recursive: true })

  await sharp(SOURCE)
    .extract({ left: 0, top: trimTop, width, height: headerHeight })
    .jpeg({ quality: 92 })
    .toFile(path.join(OUT_DIR, "header.jpg"))

  await sharp(SOURCE)
    .extract({
      left: 0,
      top: trimTop + padHeight - footerHeight,
      width,
      height: footerHeight,
    })
    .jpeg({ quality: 92 })
    .toFile(path.join(OUT_DIR, "footer.jpg"))

  const watermarkSize = Math.min(width, bodyHeight, Math.round(width * CROP.watermarkRatio))
  const watermarkX = Math.round((width - watermarkSize) / 2)
  const watermarkY = bodyTop + Math.round((bodyHeight - watermarkSize) / 2)

  await sharp(SOURCE)
    .extract({
      left: watermarkX,
      top: watermarkY,
      width: watermarkSize,
      height: watermarkSize,
    })
    .jpeg({ quality: 90 })
    .toFile(path.join(OUT_DIR, "watermark.jpg"))

  await sharp(SOURCE)
    .extract({ left: 0, top: trimTop, width, height: padHeight })
    .jpeg({ quality: 92 })
    .toFile(path.join(OUT_DIR, "full-pad.jpg"))

  console.log(
    JSON.stringify(
      {
        source: { width, height },
        crop: CROP,
        trimTop,
        trimBottom,
        padHeight,
        headerHeight,
        footerHeight,
        watermark: { x: watermarkX, y: watermarkY, size: watermarkSize },
        outDir: OUT_DIR,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
