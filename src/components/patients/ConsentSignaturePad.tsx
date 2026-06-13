"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Eraser } from "lucide-react"
import { useLocale } from "@/hooks/use-locale"

export const MIN_SIGNATURE_STROKES = 3

interface ConsentSignaturePadProps {
  value: string
  onChange: (dataUrl: string) => void
  onStrokeCountChange?: (count: number) => void
  disabled?: boolean
}

function setupCanvas(canvas: HTMLCanvasElement) {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
  const rect = canvas.getBoundingClientRect()
  const width = Math.max(rect.width, 320)
  const height = Math.max(rect.height, 144)
  canvas.width = Math.floor(width * dpr)
  canvas.height = Math.floor(height * dpr)
  const ctx = canvas.getContext("2d")
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.strokeStyle = "#171717"
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
  }
  return { width, height }
}

export function ConsentSignaturePad({
  value,
  onChange,
  onStrokeCountChange,
  disabled,
}: ConsentSignaturePadProps) {
  const { t } = useLocale()
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const drawing = React.useRef(false)
  const strokeCount = React.useRef(0)
  const [strokes, setStrokes] = React.useState(0)

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  const emitValue = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    onChange(canvas.toDataURL("image/png"))
  }

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    drawing.current = true
    canvas.setPointerCapture(e.pointerId)
    const { x, y } = getPoint(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || disabled) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    const { x, y } = getPoint(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const saved = value
      setupCanvas(canvas)
      if (saved) {
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        const img = new Image()
        img.onload = () => {
          const rect = canvas.getBoundingClientRect()
          ctx.drawImage(img, 0, 0, rect.width, rect.height)
        }
        img.src = saved
      }
    }

    resize()
    window.addEventListener("resize", resize)
    return () => window.removeEventListener("resize", resize)
  }, [value])

  React.useEffect(() => {
    onStrokeCountChange?.(strokes)
  }, [strokes, onStrokeCountChange])

  const notifyStrokes = (count: number) => {
    strokeCount.current = count
    setStrokes(count)
  }

  const endDrawWithCount = () => {
    if (!drawing.current) return
    drawing.current = false
    const next = strokeCount.current + 1
    notifyStrokes(next)
    emitValue()
  }

  const clearWithReset = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    const { width, height } = setupCanvas(canvas)
    ctx.clearRect(0, 0, width, height)
    notifyStrokes(0)
    onChange("")
  }

  const hasValidStrokes = strokes >= MIN_SIGNATURE_STROKES || value.length > 500

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {t("consent.drawSignature", "Draw signature below")}
        </p>
        <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={clearWithReset} disabled={disabled}>
          <Eraser className="h-4 w-4" />
          {t("consent.clearSignature", "Clear")}
        </Button>
      </div>
      <div className="relative rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 p-2">
        {!value ? (
          <p
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-medium text-neutral-300 select-none"
            aria-hidden
          >
            {t("consent.signHere", "Sign here")}
          </p>
        ) : null}
        <canvas
        ref={canvasRef}
        className="relative z-10 w-full h-44 rounded-md border border-neutral-200 bg-white touch-none cursor-crosshair"
        onPointerDown={startDraw}
        onPointerMove={draw}
        onPointerUp={endDrawWithCount}
        onPointerLeave={endDrawWithCount}
        aria-label={t("consent.signaturePadAria", "Signature drawing area")}
      />
      </div>
      {!value && (
        <p className="text-xs text-neutral-500">
          {t("consent.signatureHint", "Use mouse or finger to sign.")}
        </p>
      )}
      {value && !hasValidStrokes && (
        <p className="text-xs text-amber-700">
          {t("consent.signatureTooShort", "Please draw a fuller signature.")}
        </p>
      )}
    </div>
  )
}

export function isSignatureMeaningful(dataUrl: string, strokes: number): boolean {
  return strokes >= MIN_SIGNATURE_STROKES || dataUrl.length > 500
}
