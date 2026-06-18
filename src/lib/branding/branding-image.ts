export const MAX_BRANDING_IMAGE_BYTES = 2 * 1024 * 1024
const MAX_BRANDING_DIMENSION = 1800

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
