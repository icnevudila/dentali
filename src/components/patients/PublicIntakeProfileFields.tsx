"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { PatientIntakeProfile } from "@/lib/patients/patient-intake-profile"

export function PublicIntakeProfileFields({
  value,
  onChange,
  defaultOpen = false,
}: {
  value: PatientIntakeProfile
  onChange: (next: PatientIntakeProfile) => void
  defaultOpen?: boolean
}) {
  const [open, setOpen] = React.useState(defaultOpen)
  const patch = (patch: Partial<PatientIntakeProfile>) => onChange({ ...value, ...patch })

  return (
    <div className="border-t border-neutral-100 pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl px-1 py-2 text-left text-xs font-bold uppercase tracking-widest text-neutral-500 hover:text-neutral-800"
      >
        <span>Additional details for dental chart (optional)</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Middle name">
            <Input value={value.middleName ?? ""} onChange={(e) => patch({ middleName: e.target.value })} className="h-11" />
          </Field>
          <Field label="Nickname">
            <Input value={value.nickname ?? ""} onChange={(e) => patch({ nickname: e.target.value })} className="h-11" />
          </Field>
          <Field label="Religion">
            <Input value={value.religion ?? ""} onChange={(e) => patch({ religion: e.target.value })} className="h-11" />
          </Field>
          <Field label="Nationality">
            <Input value={value.nationality ?? ""} onChange={(e) => patch({ nationality: e.target.value })} className="h-11" />
          </Field>
          <Field label="Occupation">
            <Input value={value.occupation ?? ""} onChange={(e) => patch({ occupation: e.target.value })} className="h-11" />
          </Field>
          <Field label="Home phone">
            <Input value={value.homePhone ?? ""} onChange={(e) => patch({ homePhone: e.target.value })} className="h-11" />
          </Field>
          <Field label="Office phone">
            <Input value={value.officePhone ?? ""} onChange={(e) => patch({ officePhone: e.target.value })} className="h-11" />
          </Field>
          <Field label="Guardian occupation">
            <Input
              value={value.guardianOccupation ?? ""}
              onChange={(e) => patch({ guardianOccupation: e.target.value })}
              className="h-11"
            />
          </Field>
          <Field label="Previous dentist" className="sm:col-span-2">
            <Input
              value={value.previousDentist ?? ""}
              onChange={(e) => patch({ previousDentist: e.target.value })}
              className="h-11"
            />
          </Field>
          <Field label="Last dental visit">
            <Input
              type="date"
              value={value.lastDentalVisit ?? ""}
              onChange={(e) => patch({ lastDentalVisit: e.target.value })}
              className="h-11"
            />
          </Field>
          <Field label="Blood type">
            <Input value={value.bloodType ?? ""} onChange={(e) => patch({ bloodType: e.target.value })} className="h-11" />
          </Field>
          <Field label="Referral source" className="sm:col-span-2">
            <Input value={value.referralSource ?? ""} onChange={(e) => patch({ referralSource: e.target.value })} className="h-11" />
          </Field>
          <Field label="Reason for dental visit" className="sm:col-span-2">
            <textarea
              value={value.consultationReason ?? ""}
              onChange={(e) => patch({ consultationReason: e.target.value })}
              rows={2}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </Field>
        </div>
      ) : null}
    </div>
  )
}

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <label className="text-xs font-medium text-neutral-600">{label}</label>
      {children}
    </div>
  )
}
