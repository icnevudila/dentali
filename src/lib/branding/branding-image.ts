export const MAX_BRANDING_IMAGE_BYTES = 2 * 1024 * 1024
const MAX_BRANDING_DIMENSION = 1800

/** Typical prescription pad layout: header band, blank body, footer strip. */
export const PRESCRIPTION_PAD_CROP = {
  headerRatio: 0.24,
  footerRatio: 0.12,
  watermarkRatio: 0.42,
} as const

export type PrescriptionPadSplit = {
  headerDataUrl: string
  footerDataUrl: string
  watermarkDataUrl: string | null
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(new Error("Could not read file"))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Could not load image"))
    image.src = src
  })
}

export async function readBrandingImageFile(file: File): Promise<{ dataUrl: string | null; error: string | null }> {
  if (!file.type.startsWith("image/")) {
    return { dataUrl: null, error: "Please choose a PNG or JPG image." }
  }

  if (file.size > MAX_BRANDING_IMAGE_BYTES) {
    return { dataUrl: null, error: "Image exceeds 2 MB limit." }
  }

  try {
    const sourceDataUrl = await readFileAsDataUrl(file)
    const image = await loadImage(sourceDataUrl)
    const scale = Math.min(1, MAX_BRANDING_DIMENSION / Math.max(image.width, image.height))
    const width = Math.max(1, Math.round(image.width * scale))
    const height = Math.max(1, Math.round(image.height * scale))

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext("2d")
    if (!context) {
      return { dataUrl: sourceDataUrl, error: null }
    }

    context.drawImage(image, 0, 0, width, height)
    return {
      dataUrl: canvas.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.92),
      error: null,
    }
  } catch {
    return { dataUrl: null, error: "Could not process image." }
  }
}

function cropFromCanvas(
  source: HTMLCanvasElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  mime: string
): string {
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(sw))
  canvas.height = Math.max(1, Math.round(sh))
  const context = canvas.getContext("2d")
  if (!context) return ""
  context.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL(mime === "image/png" ? "image/png" : "image/jpeg", 0.92)
}

export async function splitPrescriptionPadImage(
  file: File,
  ratios: {
    headerRatio?: number
    footerRatio?: number
    watermarkRatio?: number
  } = {}
): Promise<{ data: PrescriptionPadSplit | null; error: string | null }> {
  if (!file.type.startsWith("image/")) {
    return { data: null, error: "Please choose a PNG or JPG image." }
  }

  if (file.size > MAX_BRANDING_IMAGE_BYTES) {
    return { data: null, error: "Image exceeds 2 MB limit." }
  }

  const headerRatio = ratios.headerRatio ?? PRESCRIPTION_PAD_CROP.headerRatio
  const footerRatio = ratios.footerRatio ?? PRESCRIPTION_PAD_CROP.footerRatio
  const watermarkRatio = ratios.watermarkRatio ?? PRESCRIPTION_PAD_CROP.watermarkRatio

  try {
    const sourceDataUrl = await readFileAsDataUrl(file)
    const image = await loadImage(sourceDataUrl)
    const scale = Math.min(1, MAX_BRANDING_DIMENSION / Math.max(image.width, image.height))
    const width = Math.max(1, Math.round(image.width * scale))
    const height = Math.max(1, Math.round(image.height * scale))

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")
    if (!context) {
      return { data: null, error: "Could not process image." }
    }
    context.drawImage(image, 0, 0, width, height)

    const mime = file.type === "image/png" ? "image/png" : "image/jpeg"
    const headerHeight = Math.max(1, Math.round(height * headerRatio))
    const footerHeight = Math.max(1, Math.round(height * footerRatio))
    const bodyTop = headerHeight
    const bodyHeight = Math.max(1, height - headerHeight - footerHeight)

    const headerDataUrl = cropFromCanvas(canvas, 0, 0, width, headerHeight, mime)
    const footerDataUrl = cropFromCanvas(
      canvas,
      0,
      height - footerHeight,
      width,
      footerHeight,
      mime
    )

    const watermarkSize = Math.min(width, bodyHeight, Math.round(width * watermarkRatio))
    const watermarkX = Math.round((width - watermarkSize) / 2)
    const watermarkY = bodyTop + Math.round((bodyHeight - watermarkSize) / 2)
    const watermarkDataUrl = cropFromCanvas(
      canvas,
      watermarkX,
      watermarkY,
      watermarkSize,
      watermarkSize,
      mime
    )

    if (!headerDataUrl || !footerDataUrl) {
      return { data: null, error: "Could not crop prescription pad regions." }
    }

    return {
      data: {
        headerDataUrl,
        footerDataUrl,
        watermarkDataUrl: watermarkDataUrl || null,
      },
      error: null,
    }
  } catch {
    return { data: null, error: "Could not split prescription pad image." }
  }
}
