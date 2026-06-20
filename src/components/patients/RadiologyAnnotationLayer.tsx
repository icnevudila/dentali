"use client"

import * as React from "react"
import {
  createAnnotationId,
  freehandToPolyline,
  normalizedDistance,
  toSvgPoint,
  type NormalizedPoint,
  type RadiologyAnnotation,
  type RadiologyDrawTool,
  type RadiologyStrokeColor,
} from "@/lib/radiology/annotation-types"

const VIEWBOX = 1000
const STROKE_WIDTH = 3.5
const MIN_FREEHAND_STEP = 0.004

type DraftState =
  | { type: "freehand"; color: RadiologyStrokeColor; points: NormalizedPoint[] }
  | { type: "arrow"; color: RadiologyStrokeColor; from: NormalizedPoint; to: NormalizedPoint }
  | { type: "circle"; color: RadiologyStrokeColor; center: NormalizedPoint; edge: NormalizedPoint }
  | null

type RadiologyAnnotationLayerProps = {
  imageRef: React.RefObject<HTMLImageElement | null>
  annotations: RadiologyAnnotation[]
  onAnnotationsChange: (next: RadiologyAnnotation[]) => void
  tool: RadiologyDrawTool
  color: RadiologyStrokeColor
  enabled: boolean
}

function clientToNormalized(clientX: number, clientY: number, image: HTMLImageElement): NormalizedPoint | null {
  const rect = image.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null

  const x = (clientX - rect.left) / rect.width
  const y = (clientY - rect.top) / rect.height

  if (x < 0 || x > 1 || y < 0 || y > 1) return null
  return { x, y }
}

function renderAnnotation(annotation: RadiologyAnnotation) {
  const markerId = `arrow-${annotation.color.replace("#", "")}`

  switch (annotation.type) {
    case "freehand":
      if (annotation.points.length < 2) return null
      return (
        <polyline
          key={annotation.id}
          points={freehandToPolyline(annotation.points)}
          fill="none"
          stroke={annotation.color}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
    case "arrow":
      return (
        <line
          key={annotation.id}
          x1={annotation.from.x * VIEWBOX}
          y1={annotation.from.y * VIEWBOX}
          x2={annotation.to.x * VIEWBOX}
          y2={annotation.to.y * VIEWBOX}
          stroke={annotation.color}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          markerEnd={`url(#${markerId})`}
        />
      )
    case "circle":
      return (
        <circle
          key={annotation.id}
          cx={annotation.center.x * VIEWBOX}
          cy={annotation.center.y * VIEWBOX}
          r={annotation.radius * VIEWBOX}
          fill="none"
          stroke={annotation.color}
          strokeWidth={STROKE_WIDTH}
        />
      )
  }
}

function renderDraft(draft: DraftState) {
  if (!draft) return null
  const markerId = `arrow-${draft.color.replace("#", "")}`

  switch (draft.type) {
    case "freehand":
      if (draft.points.length < 2) return null
      return (
        <polyline
          points={freehandToPolyline(draft.points)}
          fill="none"
          stroke={draft.color}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.85}
        />
      )
    case "arrow":
      return (
        <line
          x1={draft.from.x * VIEWBOX}
          y1={draft.from.y * VIEWBOX}
          x2={draft.to.x * VIEWBOX}
          y2={draft.to.y * VIEWBOX}
          stroke={draft.color}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          markerEnd={`url(#${markerId})`}
          opacity={0.85}
        />
      )
    case "circle": {
      const radius = normalizedDistance(draft.center, draft.edge)
      if (radius < 0.005) return null
      return (
        <circle
          cx={draft.center.x * VIEWBOX}
          cy={draft.center.y * VIEWBOX}
          r={radius * VIEWBOX}
          fill="none"
          stroke={draft.color}
          strokeWidth={STROKE_WIDTH}
          opacity={0.85}
        />
      )
    }
  }
}

export function RadiologyAnnotationLayer({
  imageRef,
  annotations,
  onAnnotationsChange,
  tool,
  color,
  enabled,
}: RadiologyAnnotationLayerProps) {
  const [draft, setDraft] = React.useState<DraftState>(null)
  const drawingRef = React.useRef(false)

  const commitAnnotation = React.useCallback(
    (annotation: RadiologyAnnotation) => {
      onAnnotationsChange([...annotations, annotation])
    },
    [annotations, onAnnotationsChange]
  )

  const finishDraft = React.useCallback(
    (finalDraft: DraftState) => {
      if (!finalDraft) return

      switch (finalDraft.type) {
        case "freehand":
          if (finalDraft.points.length >= 2) {
            commitAnnotation({
              id: createAnnotationId(),
              type: "freehand",
              color: finalDraft.color,
              points: finalDraft.points,
            })
          }
          break
        case "arrow":
          if (normalizedDistance(finalDraft.from, finalDraft.to) >= 0.01) {
            commitAnnotation({
              id: createAnnotationId(),
              type: "arrow",
              color: finalDraft.color,
              from: finalDraft.from,
              to: finalDraft.to,
            })
          }
          break
        case "circle": {
          const radius = normalizedDistance(finalDraft.center, finalDraft.edge)
          if (radius >= 0.01) {
            commitAnnotation({
              id: createAnnotationId(),
              type: "circle",
              color: finalDraft.color,
              center: finalDraft.center,
              radius,
            })
          }
          break
        }
      }
    },
    [commitAnnotation]
  )

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!enabled) return
    const image = imageRef.current
    if (!image) return

    const point = clientToNormalized(event.clientX, event.clientY, image)
    if (!point) return

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drawingRef.current = true

    if (tool === "freehand") {
      setDraft({ type: "freehand", color, points: [point] })
    } else if (tool === "arrow") {
      setDraft({ type: "arrow", color, from: point, to: point })
    } else {
      setDraft({ type: "circle", color, center: point, edge: point })
    }
  }

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drawingRef.current || !enabled) return
    const image = imageRef.current
    if (!image) return

    const point = clientToNormalized(event.clientX, event.clientY, image)
    if (!point) return

    setDraft((current) => {
      if (!current) return current

      if (current.type === "freehand") {
        const last = current.points[current.points.length - 1]
        if (last && normalizedDistance(last, point) < MIN_FREEHAND_STEP) return current
        return { ...current, points: [...current.points, point] }
      }

      if (current.type === "arrow") {
        return { ...current, to: point }
      }

      return { ...current, edge: point }
    })
  }

  const endDrawing = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drawingRef.current) return
    drawingRef.current = false

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    setDraft((current) => {
      finishDraft(current)
      return null
    })
  }

  return (
    <svg
      className={`absolute inset-0 h-full w-full touch-none ${enabled ? "cursor-crosshair" : "pointer-events-none"}`}
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      preserveAspectRatio="none"
      aria-hidden={!enabled}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrawing}
      onPointerCancel={endDrawing}
    >
      <defs>
        {(["#ef4444", "#eab308", "#3b82f6"] as const).map((strokeColor) => (
          <marker
            key={strokeColor}
            id={`arrow-${strokeColor.replace("#", "")}`}
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L8,4 L0,8 Z" fill={strokeColor} />
          </marker>
        ))}
      </defs>

      {annotations.map((annotation) => renderAnnotation(annotation))}
      {renderDraft(draft)}
    </svg>
  )
}
