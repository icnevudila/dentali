"use client"

import * as React from "react"
import { List } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatBulletLines, insertBulletAtCursor } from "@/lib/text/bullet-text"

export function BulletTextarea({
  value,
  onChange,
  placeholder,
  rows = 4,
  disabled,
  className,
  id,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  disabled?: boolean
  className?: string
  id?: string
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null)

  const addBullet = () => {
    const el = ref.current
    if (!el) return
    const next = insertBulletAtCursor(value, el.selectionStart, el.selectionEnd)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      const pos = next.length
      el.setSelectionRange(pos, pos)
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          Bullet list supported
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={addBullet}
          disabled={disabled}
        >
          <List className="h-3.5 w-3.5" />
          Add bullet
        </Button>
      </div>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm leading-relaxed",
          "focus:outline-none focus:ring-2 focus:ring-primary-500/30",
          disabled && "opacity-60 cursor-not-allowed",
          className
        )}
      />
      {value.trim() ? (
        <div className="rounded-md border border-neutral-100 bg-neutral-50/80 px-3 py-2 text-xs text-neutral-600">
          <p className="mb-1 font-medium text-neutral-500">Preview</p>
          <ul className="list-disc space-y-1 pl-4">
            {formatBulletLines(value).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
