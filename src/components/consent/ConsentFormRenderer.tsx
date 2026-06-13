"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { ConsentField, ConsentFieldResponses } from "@/lib/consent/consent-field-types"
import { isConsentFieldComplete } from "@/lib/consent/consent-field-types"
import { formatFieldResponseForDisplay } from "@/lib/consent/consent-template-render"

const PARAGRAPH_ACCORDION_THRESHOLD = 280

function fieldShellClass(complete: boolean, required?: boolean) {
  return cn(
    "rounded-lg border bg-white px-3 py-3 transition-[border-color,box-shadow] duration-200",
    complete && required
      ? "border-primary-200/90 shadow-[inset_0_0_0_1px_rgba(20,184,166,0.08)]"
      : "border-neutral-100"
  )
}

function paragraphSummary(text: string): string {
  const firstLine = text.split("\n").find((line) => line.trim())?.trim() ?? text.trim()
  if (firstLine.length <= 72) return firstLine
  return `${firstLine.slice(0, 69).trim()}…`
}

function ConsentParagraphBlock({
  text,
  defaultOpen = false,
  readOnly,
}: {
  text: string
  defaultOpen?: boolean
  readOnly?: boolean
}) {
  const trimmed = text.trim()
  if (!trimmed) return null

  const useAccordion = trimmed.length >= PARAGRAPH_ACCORDION_THRESHOLD

  if (!useAccordion) {
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700 border-l-2 border-primary-200/80 pl-3">
        {trimmed}
      </p>
    )
  }

  return (
    <details
      open={defaultOpen}
      className="group rounded-lg border border-neutral-200 bg-white/80 open:shadow-sm"
    >
      <summary className="flex cursor-pointer list-none items-start gap-2 px-4 py-3 text-sm font-medium text-neutral-800 marker:content-none [&::-webkit-details-marker]:hidden">
        <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400 transition-transform group-open:rotate-180" />
        <span className="text-left">{paragraphSummary(trimmed)}</span>
      </summary>
      <div
        className={cn(
          "border-t border-neutral-100 px-4 pb-4 pt-2 text-sm leading-relaxed text-neutral-700 whitespace-pre-wrap",
          readOnly && "text-neutral-800"
        )}
      >
        {trimmed}
      </div>
    </details>
  )
}

export function ConsentFormRenderer({
  fields,
  values,
  onChange,
  disabled,
  readOnly,
  className,
  documentMode,
}: {
  fields: ConsentField[]
  values: ConsentFieldResponses
  onChange?: (next: ConsentFieldResponses) => void
  disabled?: boolean
  readOnly?: boolean
  className?: string
  /** Paper-style flow without the “Information to complete” chrome. */
  documentMode?: boolean
}) {
  if (fields.length === 0) return null

  const set = (id: string, value: string | boolean) => {
    onChange?.({ ...values, [id]: value })
  }

  const paragraphOpenByIndex = React.useMemo(() => {
    let index = 0
    return fields.map((field) => {
      if (field.type !== "paragraph") return false
      const openFirst = index === 0
      index += 1
      return openFirst
    })
  }, [fields])

  return (
    <div
      className={cn(
        documentMode ? "space-y-4" : "space-y-4 rounded-lg border border-neutral-200 bg-neutral-50/50 p-4",
        className
      )}
    >
      {!documentMode ? (
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Information to complete
        </p>
      ) : null}
      {fields.map((field, fieldIndex) => {
        if (field.type === "paragraph") {
          return (
            <ConsentParagraphBlock
              key={field.id}
              text={field.label}
              defaultOpen={paragraphOpenByIndex[fieldIndex]}
              readOnly={readOnly}
            />
          )
        }

        return (
          <ConsentFieldControl
            key={field.id}
            field={field}
            value={values[field.id]}
            disabled={disabled}
            readOnly={readOnly}
            onChange={(v) => set(field.id, v)}
          />
        )
      })}
    </div>
  )
}

function ConsentFieldControl({
  field,
  value,
  onChange,
  disabled,
  readOnly,
}: {
  field: ConsentField
  value: string | boolean | undefined
  onChange: (v: string | boolean) => void
  disabled?: boolean
  readOnly?: boolean
}) {
  const id = `consent-field-${field.id}`

  if (readOnly) {
    if (field.type === "paragraph") return null
    const display = formatFieldResponseForDisplay(field, value)
    if (display === "—") return null
    return (
      <div className="grid gap-0.5 rounded-md border border-neutral-100 bg-white/90 px-3 py-2 sm:grid-cols-[1fr_auto] sm:items-baseline sm:gap-4">
        <dt className="text-sm text-neutral-600">{field.label}</dt>
        <dd className="text-sm font-medium text-neutral-900 sm:text-right">{display}</dd>
      </div>
    )
  }

  if (field.type === "checkbox") {
    const complete = isConsentFieldComplete(field, value)
    return (
      <div className={fieldShellClass(complete, field.required)}>
        <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm text-neutral-800">
          <input
            id={id}
            type="checkbox"
            checked={value === true}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
            className="mt-0.5 rounded border-neutral-300 text-primary-600"
          />
          <span>
            {field.label}
            {field.required ? <span className="text-red-500"> *</span> : null}
            {field.helpText ? <span className="mt-0.5 block text-xs text-neutral-500">{field.helpText}</span> : null}
          </span>
        </label>
      </div>
    )
  }

  if (field.type === "yes_no") {
    const complete = isConsentFieldComplete(field, value)
    return (
      <fieldset className={cn(fieldShellClass(complete, field.required), "space-y-2.5")}>
        <legend className="text-sm font-medium text-neutral-800">
          {field.label}
          {field.required ? <span className="text-red-500"> *</span> : null}
        </legend>
        <div
          className="inline-flex w-full max-w-xs rounded-lg border border-neutral-200 bg-neutral-50 p-0.5"
          role="radiogroup"
          aria-label={field.label}
        >
          {(["yes", "no"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={value === opt}
              disabled={disabled}
              onClick={() => onChange(opt)}
              className={cn(
                "flex-1 rounded-md px-4 py-2 text-sm capitalize transition-all",
                value === opt
                  ? "bg-white font-medium text-primary-900 shadow-sm ring-1 ring-neutral-200/80"
                  : "text-neutral-600 hover:text-neutral-900"
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      </fieldset>
    )
  }

  if (field.type === "select" && field.options?.length) {
    const complete = isConsentFieldComplete(field, value)
    return (
      <div className={cn(fieldShellClass(complete, field.required), "space-y-1.5")}>
        <label htmlFor={id} className="text-sm font-medium text-neutral-800">
          {field.label}
          {field.required ? <span className="text-red-500"> *</span> : null}
        </label>
        <select
          id={id}
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Select…</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {field.helpText ? <p className="text-xs text-neutral-500">{field.helpText}</p> : null}
      </div>
    )
  }

  const complete = isConsentFieldComplete(field, value)
  return (
    <div className={cn(fieldShellClass(complete, field.required), "space-y-1.5")}>
      <label htmlFor={id} className="text-sm font-medium text-neutral-800">
        {field.label}
        {field.required ? <span className="text-red-500"> *</span> : null}
      </label>
      <Input
        id={id}
        type={field.type === "date" ? "date" : "text"}
        value={typeof value === "string" ? value : ""}
        placeholder={field.placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white"
        maxLength={field.type === "initials" ? 8 : undefined}
      />
      {field.helpText ? <p className="text-xs text-neutral-500">{field.helpText}</p> : null}
    </div>
  )
}

/** Read-only filled responses for signed PDF / view (legacy flat summary). */
export function ConsentResponsesSummary({
  fields,
  responses,
  className,
}: {
  fields: ConsentField[]
  responses: ConsentFieldResponses
  className?: string
}) {
  const filled = fields.filter((f) => f.type !== "paragraph" && responses[f.id] !== undefined)
  if (filled.length === 0) return null

  return (
    <dl className={cn("grid gap-2 rounded-lg border border-neutral-100 bg-white p-4 text-sm", className)}>
      <dt className="col-span-full text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">
        Completed responses
      </dt>
      {filled.map((f) => (
        <div key={f.id} className="grid gap-0.5 sm:grid-cols-[1fr_1fr]">
          <dt className="text-neutral-500">{f.label}</dt>
          <dd className="font-medium text-neutral-900">
            {formatFieldResponseForDisplay(f, responses[f.id])}
          </dd>
        </div>
      ))}
    </dl>
  )
}
