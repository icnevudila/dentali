"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  PDA_ALLERGY_LABELS,
  PDA_MEDICAL_QUESTION_LABELS,
  type PdaYesNo,
} from "@/lib/pda/pda-intake-schema"
import type { PatientIntakeProfile } from "@/lib/patients/patient-intake-profile"
import { cn } from "@/lib/utils"

function YesNoSelect({
  value,
  onChange,
  label,
}: {
  value: PdaYesNo
  onChange: (v: PdaYesNo) => void
  label: string
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-neutral-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as PdaYesNo)}
        className="flex h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm"
      >
        <option value="">—</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
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
    <div className={cn("space-y-1.5", className)}>
      <label className="text-sm font-medium text-neutral-900">{label}</label>
      {children}
    </div>
  )
}

export function PatientIntakeProfilePanel({
  value,
  onChange,
}: {
  value: PatientIntakeProfile
  onChange: (next: PatientIntakeProfile) => void
}) {
  const patch = (patch: Partial<PatientIntakeProfile>) => onChange({ ...value, ...patch })

  const patchQuestion = (key: string, v: PdaYesNo | string, isDetail = false) => {
    const questions = { ...(value.medicalQuestions ?? {}) }
    if (isDetail) {
      ;(questions as Record<string, string>)[key] = v as string
    } else {
      ;(questions as Record<string, PdaYesNo>)[key] = v as PdaYesNo
    }
    onChange({ ...value, medicalQuestions: questions })
  }

  const patchAllergy = (key: string, v: PdaYesNo) => {
    onChange({
      ...value,
      allergyFlags: { ...(value.allergyFlags ?? {}), [key]: v },
    })
  }

  const q = value.medicalQuestions ?? {}

  return (
    <Card>
      <CardHeader>
        <CardTitle>PDA intake details</CardTitle>
        <CardDescription>
          Extra fields for the official PDA dental chart. These auto-fill when you open or print the PDA form.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-neutral-900">Demographics & contact</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Middle name">
              <Input value={value.middleName ?? ""} onChange={(e) => patch({ middleName: e.target.value })} />
            </Field>
            <Field label="Nickname">
              <Input value={value.nickname ?? ""} onChange={(e) => patch({ nickname: e.target.value })} />
            </Field>
            <Field label="Religion">
              <Input value={value.religion ?? ""} onChange={(e) => patch({ religion: e.target.value })} />
            </Field>
            <Field label="Nationality">
              <Input value={value.nationality ?? ""} onChange={(e) => patch({ nationality: e.target.value })} />
            </Field>
            <Field label="Occupation">
              <Input value={value.occupation ?? ""} onChange={(e) => patch({ occupation: e.target.value })} />
            </Field>
            <Field label="Home phone">
              <Input value={value.homePhone ?? ""} onChange={(e) => patch({ homePhone: e.target.value })} />
            </Field>
            <Field label="Office phone">
              <Input value={value.officePhone ?? ""} onChange={(e) => patch({ officePhone: e.target.value })} />
            </Field>
            <Field label="Fax">
              <Input value={value.fax ?? ""} onChange={(e) => patch({ fax: e.target.value })} />
            </Field>
            <Field label="Guardian occupation">
              <Input
                value={value.guardianOccupation ?? ""}
                onChange={(e) => patch({ guardianOccupation: e.target.value })}
              />
            </Field>
            <Field label="Referral source" className="md:col-span-2">
              <Input value={value.referralSource ?? ""} onChange={(e) => patch({ referralSource: e.target.value })} />
            </Field>
            <Field label="Reason for dental consultation" className="md:col-span-2">
              <textarea
                value={value.consultationReason ?? ""}
                onChange={(e) => patch({ consultationReason: e.target.value })}
                rows={3}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-neutral-900">Dental history</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Previous dentist">
              <Input
                value={value.previousDentist ?? ""}
                onChange={(e) => patch({ previousDentist: e.target.value })}
              />
            </Field>
            <Field label="Last dental visit">
              <Input
                type="date"
                value={value.lastDentalVisit ?? ""}
                onChange={(e) => patch({ lastDentalVisit: e.target.value })}
              />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-neutral-900">Physician & vitals</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Physician name">
              <Input value={value.physicianName ?? ""} onChange={(e) => patch({ physicianName: e.target.value })} />
            </Field>
            <Field label="Specialty">
              <Input
                value={value.physicianSpecialty ?? ""}
                onChange={(e) => patch({ physicianSpecialty: e.target.value })}
              />
            </Field>
            <Field label="Office address" className="md:col-span-2">
              <Input
                value={value.physicianAddress ?? ""}
                onChange={(e) => patch({ physicianAddress: e.target.value })}
              />
            </Field>
            <Field label="Office phone">
              <Input value={value.physicianPhone ?? ""} onChange={(e) => patch({ physicianPhone: e.target.value })} />
            </Field>
            <Field label="Bleeding time">
              <Input value={value.bleedingTime ?? ""} onChange={(e) => patch({ bleedingTime: e.target.value })} />
            </Field>
            <Field label="Blood type">
              <Input value={value.bloodType ?? ""} onChange={(e) => patch({ bloodType: e.target.value })} />
            </Field>
            <Field label="Blood pressure">
              <Input value={value.bloodPressure ?? ""} onChange={(e) => patch({ bloodPressure: e.target.value })} />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-neutral-900">Medical questionnaire (PDA)</h3>
          <p className="text-xs text-neutral-500">
            Allergies, medications, and conditions on the Medical history page also feed the PDA form. Use these for
            yes/no answers on the official chart.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {PDA_MEDICAL_QUESTION_LABELS.map((item) => (
              <React.Fragment key={item.key}>
                <YesNoSelect
                  label={item.label}
                  value={(q[item.key] as PdaYesNo) ?? ""}
                  onChange={(v) => patchQuestion(item.key, v)}
                />
                {item.detailKey && q[item.key] === "yes" ? (
                  <Field label="Details" className="sm:col-span-2">
                    <Input
                      value={String(q[item.detailKey] ?? "")}
                      onChange={(e) => patchQuestion(item.detailKey!, e.target.value, true)}
                    />
                  </Field>
                ) : null}
              </React.Fragment>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {PDA_ALLERGY_LABELS.map((item) => (
              <YesNoSelect
                key={item.key}
                label={item.label}
                value={value.allergyFlags?.[item.key] ?? ""}
                onChange={(v) => patchAllergy(item.key, v)}
              />
            ))}
          </div>
          <Field label="Other allergies">
            <Input value={value.allergyOther ?? ""} onChange={(e) => patch({ allergyOther: e.target.value })} />
          </Field>
        </section>
      </CardContent>
    </Card>
  )
}
