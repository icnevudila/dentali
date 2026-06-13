/** Export an inline SVG element to PNG (patient record attachment). */
export async function exportSvgElementToPng(
  svg: SVGSVGElement,
  filename: string,
  scale = 2
): Promise<void> {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")

  const viewBox = clone.viewBox.baseVal
  const width = viewBox.width > 0 ? viewBox.width : clone.width.baseVal.value || 800
  const height = viewBox.height > 0 ? viewBox.height : clone.height.baseVal.value || 600

  clone.setAttribute("width", String(width))
  clone.setAttribute("height", String(height))

  const svgString = new XMLSerializer().serializeToString(clone)
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" })
  const svgUrl = URL.createObjectURL(svgBlob)

  try {
    const img = await loadImage(svgUrl)
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas not supported")

    ctx.fillStyle = "#f8fafc"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0, width, height)

    const pngBlob = await canvasToBlob(canvas)
    downloadBlob(pngBlob, filename.endsWith(".png") ? filename : `${filename}.png`)
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

export function findOdontogramSvg(root: ParentNode): SVGSVGElement | null {
  return (
    root.querySelector("#interactive-odontogram") ??
    root.querySelector("#interactive-primary-odontogram") ??
    root.querySelector("svg")
  )
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("SVG rasterization failed"))
    img.src = src
  })
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error("PNG export failed"))
    }, "image/png")
  })
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
