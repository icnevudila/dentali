"use client"

import * as React from "react"
import type { ToothFinding } from "@/lib/types/dental"
import { buildFindingsByTooth, syncOdontogramVisuals } from "@/lib/odontogram/odontogram-svg-sync"

type LoadState = "loading" | "ready" | "error"

export function useOdontogramSvg(options: {
  svgPath: string
  svgId: string
  findings: ToothFinding[]
  selectedTooth?: number | null
  onToothClick?: (toothNumber: number) => void
  showAnatomy?: boolean
  compact?: boolean
  interactive?: boolean
}) {
  const {
    svgPath,
    svgId,
    findings,
    selectedTooth = null,
    onToothClick,
    showAnatomy = false,
    compact = false,
    interactive = false,
  } = options

  const containerRef = React.useRef<HTMLDivElement>(null)
  const [loadState, setLoadState] = React.useState<LoadState>("loading")

  const findingsByTooth = React.useMemo(() => buildFindingsByTooth(findings), [findings])

  const syncVisuals = React.useCallback(() => {
    const root = containerRef.current
    if (!root) return
    syncOdontogramVisuals(root, svgId, findingsByTooth, selectedTooth, {
      showAnatomy: compact ? false : showAnatomy,
      compact,
    })
  }, [compact, findingsByTooth, selectedTooth, showAnatomy, svgId])

  React.useEffect(() => {
    let cancelled = false
    const container = containerRef.current
    if (!container) return

    setLoadState("loading")
    container.innerHTML = ""

    fetch(svgPath)
      .then((res) => {
        if (!res.ok) {
          console.error(`useOdontogramSvg: Failed to fetch SVG at path: ${svgPath}. Status: ${res.status}`);
          throw new Error("SVG not found");
        }
        return res.text();
      })
      .then((svgMarkup) => {
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = svgMarkup;
        setLoadState("ready");
      })
      .catch((err) => {
        console.error("useOdontogramSvg: Fetch error caught:", err);
        if (!cancelled) setLoadState("error");
      });

    return () => {
      cancelled = true
    }
  }, [svgPath])

  React.useEffect(() => {
    if (loadState !== "ready") return
    syncVisuals()
  }, [loadState, syncVisuals])

  React.useEffect(() => {
    const container = containerRef.current
    if (!container || loadState !== "ready" || !interactive || !onToothClick) return

    const handleClick = (event: MouseEvent) => {
      const tooth = (event.target as Element).closest<SVGGElement>(".tooth")
      if (!tooth) return
      const toothNumber = tooth.getAttribute("data-tooth")
      if (toothNumber) onToothClick(parseInt(toothNumber, 10))
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as Element
      if (!target.classList.contains("tooth") && !target.closest(".tooth")) return
      const tooth = target.classList.contains("tooth")
        ? (target as SVGGElement)
        : target.closest<SVGGElement>(".tooth")
      if (!tooth) return
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        const toothNumber = tooth.getAttribute("data-tooth")
        if (toothNumber) onToothClick(parseInt(toothNumber, 10))
      }
    }

    container.addEventListener("click", handleClick)
    container.addEventListener("keydown", handleKeyDown)
    return () => {
      container.removeEventListener("click", handleClick)
      container.removeEventListener("keydown", handleKeyDown)
    }
  }, [interactive, loadState, onToothClick])

  return { containerRef, loadState, syncVisuals }
}
