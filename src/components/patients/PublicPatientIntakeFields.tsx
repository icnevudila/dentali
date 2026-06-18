"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { PublicIntakeFormState } from "@/lib/patients/public-intake-form"
import { PublicIntakeProfileFields } from "@/components/patients/PublicIntakeProfileFields"

const inputClass =
  "h-12 rounded-xl border-2 border-transparent bg-white/80 px-4 shadow-sm placeholder:text-neutral-300 outline-none transition-all focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10"

const labelClass = "pl-1 text-xs font-bold uppercase tracking-wider text-neutral-500"

export function PublicPatientIntakeFields({
  value,
  onChange,
  showExtended = true,
  className,
}: {
  value: PublicIntakeFormState
  onChange: (next: PublicIntakeFormState) => void
  showExtended?: boolean
  className?: string
}) {
  const patch = (patch: Partial<PublicIntakeFormState>) => onChange({ ...value, ...patch })

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={labelClass}>First name</label>
          <Input
            required
            value={value.firstName}
            onChange={(e) => patch({ firstName: e.target.value })}
            className={inputClass}
            autoComplete="given-name"
          />
        </div>
        <div className="space-y-1.5">
          <label className={labelClass}>Last name</label>
          <Input
            required
            value={value.lastName}
            onChange={(e) => patch({ lastName: e.target.value })}
            className={inputClass}
            autoComplete="family-name"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={labelClass}>Mobile number</label>
        <Input
          type="tel"
          required
          value={value.phone}
          onChange={(e) => patch({ phone: e.target.value })}
          className={inputClass}
          autoComplete="tel"
        />
      </div>

      <div className="space-y-1.5">
        <label className={labelClass}>Email</label>
        <Input
          type="email"
          value={value.email}
          onChange={(e) => patch({ email: e.target.value })}
          className={inputClass}
          autoComplete="email"
        />
      </div>

      {showExtended ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelClass}>Date of birth</label>
              <Input
                type="date"
                value={value.dateOfBirth}
                onChange={(e) => patch({ dateOfBirth: e.target.value })}
                className={cn(inputClass, "text-sm")}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Gender</label>
              <select
                value={value.gender}
                onChange={(e) => patch({ gender: e.target.value })}
                className={cn(inputClass, "w-full text-sm")}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other / Prefer not to say</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelClass}>Address</label>
              <Input
                value={value.addressLine1}
                onChange={(e) => patch({ addressLine1: e.target.value })}
                className={inputClass}
                autoComplete="street-address"
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>City</label>
              <Input
                value={value.city}
                onChange={(e) => patch({ city: e.target.value })}
                className={inputClass}
                autoComplete="address-level2"
              />
            </div>
          </div>

          <div className="border-t border-neutral-100 pt-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-neutral-400">Emergency contact</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={labelClass}>Contact name</label>
                <Input
                  value={value.emergencyContactName}
                  onChange={(e) => patch({ emergencyContactName: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Contact phone</label>
                <Input
                  type="tel"
                  value={value.emergencyContactPhone}
                  onChange={(e) => patch({ emergencyContactPhone: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5 border-t border-neutral-100 pt-4">
            <label className={labelClass}>Medical history / allergies</label>
            <textarea
              value={value.medicalAlerts}
              onChange={(e) => patch({ medicalAlerts: e.target.value })}
              placeholder="Chronic conditions, medications, or allergies..."
              className="min-h-[80px] w-full rounded-xl border-2 border-transparent bg-white/80 p-3 text-sm shadow-sm outline-none focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10"
            />
          </div>

          <PublicIntakeProfileFields
            value={value.intakeProfile}
            onChange={(intakeProfile) => patch({ intakeProfile })}
          />
        </>
      ) : null}
    </div>
  )
}
