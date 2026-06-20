export type RadiologyDrawTool = "freehand" | "arrow" | "circle"

export type RadiologyStrokeColor = "#ef4444" | "#eab308" | "#3b82f6"

export const RADIOLOGY_STROKE_COLORS: RadiologyStrokeColor[] = ["#ef4444", "#eab308", "#3b82f6"]

export type NormalizedPoint = { x: number; y: number }

export type RadiologyAnnotation =
  | { id: string; type: "freehand"; color: RadiologyStrokeColor; points: NormalizedPoint[] }
  | { id: string; type: "arrow"; color: RadiologyStrokeColor; from: NormalizedPoint; to: NormalizedPoint }
  | { id: string; type: "circle"; color: RadiologyStrokeColor; center: NormalizedPoint; radius: number }

export type InteractionMode = "navigate" | "draw"

export function createAnnotationId() {
  return `ann-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function normalizedDistance(a: NormalizedPoint, b: NormalizedPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function toSvgPoint(point: NormalizedPoint) {
  return `${point.x * 1000},${point.y * 1000}`
}

export function freehandToPolyline(points: NormalizedPoint[]) {
  return points.map(toSvgPoint).join(" ")
}
