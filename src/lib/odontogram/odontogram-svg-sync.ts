import type { ToothFinding } from "@/lib/types/dental"
import {
  applyVisualStateClasses,
  buildFindingsByTooth,
} from "@/lib/odontogram/tooth-visual-state"

const SURFACE_DOT_POSITIONS: Record<string, [number, number]> = {
  top: [0, -20],
  bottom: [0, 20],
  left: [-18, 0],
  right: [18, 0],
  center: [0, 0],
}

export function applySurfaceDots(toothEl: SVGGElement, finding?: ToothFinding) {
  toothEl.querySelectorAll(".surface-dot").forEach((el) => el.remove())
  if (!finding?.surfaces?.length) return

  const shape = toothEl.querySelector(".tooth-shape")
  if (!shape) return

  for (const surface of finding.surfaces) {
    const pos = SURFACE_DOT_POSITIONS[surface]
    if (!pos) continue
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle")
    dot.setAttribute("class", "surface-dot")
    dot.setAttribute("cx", String(pos[0]))
    dot.setAttribute("cy", String(pos[1]))
    dot.setAttribute("r", "4.5")
    dot.setAttribute(
      "fill",
      finding.condition === "decayed"
        ? "#dc2626"
        : finding.restoration_type
          ? "#2563eb"
          : "#0d9488"
    )
    dot.setAttribute("stroke", "#fff")
    dot.setAttribute("stroke-width", "1.5")
    dot.setAttribute("pointer-events", "none")
    shape.appendChild(dot)
  }
}

export function stripDemoChrome(svg: SVGSVGElement) {
  const statusBox = svg.querySelector(".status-box")
  statusBox?.setAttribute("display", "none")
  svg.querySelector(".legend")?.setAttribute("display", "none")
  svg.querySelector(".main-title")?.setAttribute("display", "none")
  svg.querySelector(".subtitle")?.setAttribute("display", "none")
}

export function syncOdontogramVisuals(
  root: HTMLElement,
  svgId: string,
  findingsByTooth: Map<string, ToothFinding>,
  selectedTooth: number | null,
  options?: { showAnatomy?: boolean; compact?: boolean }
) {
  const svg = root.querySelector(`#${svgId}`) as SVGSVGElement | null
  if (!svg) return

  if (!options?.compact) {
    svg.classList.toggle("clinical-mode", !options?.showAnatomy)
    if (options?.showAnatomy && svgId === "interactive-odontogram") {
      svg.setAttribute("viewBox", "0 0 1100 800")
    } else if (!options?.showAnatomy) {
      svg.setAttribute("viewBox", "395 85 690 660")
    }
    const anatomyPanel = svg.querySelector("#anatomy-panel")
    anatomyPanel?.setAttribute("display", options?.showAnatomy ? "inline" : "none")
    stripDemoChrome(svg)
  }

  svg.querySelectorAll<SVGGElement>(".tooth").forEach((toothEl) => {
    const num = toothEl.getAttribute("data-tooth")
    if (!num) return

    const finding = findingsByTooth.get(num)
    applyVisualStateClasses(toothEl, finding)

    toothEl.classList.toggle("selected", selectedTooth === parseInt(num, 10))

    let missingMark = toothEl.querySelector(".missing-mark")
    const isMissing =
      finding?.condition === "missing_caries" ||
      finding?.condition === "missing_other" ||
      finding?.condition === "indicated_extraction"

    if (isMissing && !missingMark) {
      missingMark = document.createElementNS("http://www.w3.org/2000/svg", "line")
      missingMark.setAttribute("class", "missing-mark")
      missingMark.setAttribute("x1", "-22")
      missingMark.setAttribute("y1", "-22")
      missingMark.setAttribute("x2", "22")
      missingMark.setAttribute("y2", "22")
      toothEl.querySelector(".tooth-shape")?.appendChild(missingMark)
    } else if (!isMissing && missingMark) {
      missingMark.remove()
    }

    if (!options?.compact) {
      applySurfaceDots(toothEl, finding)
    }
  })
}

export { buildFindingsByTooth, applyVisualStateClasses }
