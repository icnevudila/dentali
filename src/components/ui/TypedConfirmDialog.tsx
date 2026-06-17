"use client"

import * as React from "react"
import { AlertTriangle, Lock, Unlock, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useLocale } from "@/hooks/use-locale"
import { cn } from "@/lib/utils"

type TypedConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmToken: string
  confirmLabel: string
  cancelLabel?: string
  inputLabel?: string
  inputPlaceholder?: string
  mismatchMessage?: string
  loading?: boolean
  tone?: "warning" | "default"
  icon?: "lock" | "unlock" | "alert"
  onConfirm: () => void | Promise<void>
}

export function TypedConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmToken,
  confirmLabel,
  cancelLabel,
  inputLabel,
  inputPlaceholder,
  mismatchMessage,
  loading = false,
  tone = "warning",
  icon = "alert",
  onConfirm,
}: TypedConfirmDialogProps) {
  const { t } = useLocale()
  const [value, setValue] = React.useState("")
  const [mismatch, setMismatch] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const token = confirmToken.trim()
  const matches = value.trim().toUpperCase() === token.toUpperCase()

  React.useEffect(() => {
    if (!open) {
      setValue("")
      setMismatch(false)
      return
    }
    const id = window.setTimeout(() => inputRef.current?.focus(), 50)
    return () => window.clearTimeout(id)
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onOpenChange(false)
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener("keydown", onKey)
    }
  }, [open, loading, onOpenChange])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!matches) {
      setMismatch(true)
      return
    }
    setMismatch(false)
    await onConfirm()
  }

  if (!open) return null

  const Icon = icon === "lock" ? Lock : icon === "unlock" ? Unlock : AlertTriangle
  const borderTone = tone === "warning" ? "border-amber-200" : "border-neutral-200"
  const titleTone = tone === "warning" ? "text-amber-900" : "text-neutral-900"

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      onClick={() => {
        if (!loading) onOpenChange(false)
      }}
    >
      <Card
        className={cn(
          "w-full max-w-md bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200 sm:rounded-xl sm:slide-in-from-bottom-0 sm:zoom-in-95",
          borderTone
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="typed-confirm-title"
      >
        <CardHeader className="border-b pb-2">
          <CardTitle id="typed-confirm-title" className="flex items-center justify-between gap-2 text-base">
            <span className={cn("flex items-center gap-2", titleTone)}>
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {title}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <p className="text-sm leading-6 text-neutral-700">{description}</p>
          <form className="space-y-3" onSubmit={(e) => void handleSubmit(e)}>
            <div>
              <label htmlFor="typed-confirm-input" className="text-xs font-medium text-neutral-700">
                {inputLabel ??
                  t("common.typeToConfirm", "Type {token} to confirm").replace("{token}", token)}
              </label>
              <Input
                id="typed-confirm-input"
                ref={inputRef}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value)
                  if (mismatch) setMismatch(false)
                }}
                placeholder={inputPlaceholder ?? token}
                autoComplete="off"
                spellCheck={false}
                disabled={loading}
                className="mt-1.5 font-mono uppercase tracking-wide"
              />
              {mismatch ? (
                <p className="mt-1.5 text-xs text-red-600">
                  {mismatchMessage ??
                    t("common.typeToConfirmMismatch", "Text must match exactly: {token}").replace(
                      "{token}",
                      token
                    )}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                {cancelLabel ?? t("common.cancel", "Cancel")}
              </Button>
              <Button type="submit" disabled={loading || !value.trim()} variant="default">
                {loading ? t("common.loading", "Loading…") : confirmLabel}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
