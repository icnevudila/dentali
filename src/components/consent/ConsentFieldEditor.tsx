"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2 } from "lucide-react"
import type { ConsentField, ConsentFieldType } from "@/lib/consent/consent-field-types"

const FIELD_TYPES: { value: ConsentFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "date", label: "Date" },
  { value: "yes_no", label: "Yes / No" },
  { value: "checkbox", label: "Checkbox" },
  { value: "initials", label: "Initials" },
  { value: "select", label: "Select" },
  { value: "paragraph", label: "Paragraph (info only)" },
]

export function ConsentFieldEditor({
  fields,
  onChange,
}: {
  fields: ConsentField[]
  onChange: (fields: ConsentField[]) => void
}) {
  const addField = () => {
    onChange([
      ...fields,
      {
        id: `field_${Date.now()}`,
        type: "text",
        label: "New field",
        required: false,
      },
    ])
  }

  const update = (index: number, patch: Partial<ConsentField>) => {
    onChange(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)))
  }

  const remove = (index: number) => {
    onChange(fields.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-neutral-700">Fillable fields</p>
        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addField}>
          <Plus className="h-3.5 w-3.5" />
          Add field
        </Button>
      </div>
      {fields.length === 0 ? (
        <p className="text-xs text-neutral-500 rounded-md border border-dashed border-neutral-200 px-3 py-4 text-center">
          No fillable fields — patients will only read and sign the text above.
        </p>
      ) : (
        <div className="space-y-2">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="grid gap-2 rounded-lg border border-neutral-200 bg-neutral-50/80 p-3 sm:grid-cols-[1fr_1fr_auto]"
            >
              <Input
                value={field.label}
                onChange={(e) => update(index, { label: e.target.value })}
                placeholder="Field label"
                className="bg-white text-sm"
              />
              <select
                value={field.type}
                onChange={(e) => update(index, { type: e.target.value as ConsentFieldType })}
                className="rounded-md border border-neutral-300 bg-white px-2 py-2 text-sm"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-neutral-600 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={field.required ?? false}
                    onChange={(e) => update(index, { required: e.target.checked })}
                  />
                  Required
                </label>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(index)}>
                  <Trash2 className="h-3.5 w-3.5 text-neutral-400" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-neutral-400">
        Use {"{{patient_name}}"}, {"{{clinic_name}}"}, {"{{today_date}}"} in the body text for merge fields.
      </p>
    </div>
  )
}
