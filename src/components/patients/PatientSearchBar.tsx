"use client"

import * as React from "react"
import { Search, X, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/use-locale"
import { cn } from "@/lib/utils"

interface PatientSearchBarProps {
  value: string
  onChange: (value: string) => void
  isSearching?: boolean
  className?: string
  inputRef?: React.RefObject<HTMLInputElement | null>
}

export function PatientSearchBar({
  value,
  onChange,
  isSearching,
  className,
  inputRef: inputRefProp,
}: PatientSearchBarProps) {
  const { t } = useLocale()
  const localRef = React.useRef<HTMLInputElement>(null)
  const inputRef = inputRefProp ?? localRef

  return (
    <div className={cn("flex w-full flex-col gap-2 sm:flex-row sm:items-center", className)}>
      <div className="relative min-w-0 flex-1">
        <Search
          className={cn(
            "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors",
            isSearching ? "text-primary-400" : "text-neutral-400"
          )}
          aria-hidden
        />
        <Input
          ref={inputRef}
          type="search"
          enterKeyHint="search"
          placeholder={t("patients.searchPlaceholder", "Search by name or phone number…")}
          className="h-11 w-full border-neutral-200 bg-neutral-50/80 pl-9 pr-10 shadow-sm transition-[box-shadow,background-color] duration-200 focus-visible:bg-white focus-visible:shadow-[0_0_0_3px_rgba(20,184,166,0.12)]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={t("patients.searchPlaceholder", "Search by name or phone number…")}
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
          {isSearching ? (
            <Loader2
              className="h-4 w-4 animate-spin text-primary-500"
              aria-label={t("patients.searching", "Searching…")}
            />
          ) : value ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-neutral-400 hover:text-neutral-700"
              onClick={() => {
                onChange("")
                inputRef.current?.focus()
              }}
              aria-label={t("patients.clearSearch", "Clear search")}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>
      {value ? (
        <p className="shrink-0 text-xs text-neutral-500 sm:max-w-[10rem] sm:truncate">
          {t("patients.searchActive", "Filtering results")}
        </p>
      ) : null}
    </div>
  )
}
