"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  PDA_ALLERGY_LABELS,
  PDA_MEDICAL_QUESTION_LABELS,
  type PdaIntakeResponses,
  type PdaYesNo,
} from "@/lib/pda/pda-intake-schema"
import type { ToothFinding } from "@/lib/types/dental"
import type { TreatmentTimelineEntry } from "@/lib/clinical/treatment-plan-service"
import {
  formatToothFindingLine,
  formatTreatmentTimelineLine,
} from "@/lib/odontogram/clinical-display"

type SectionId = "patient" | "dental" | "medical" | "chart"

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "patient", label: "Patient info" },
  { id: "dental", label: "Dental history" },
  { id: "medical", label: "Medical history" },
  { id: "chart", label: "Chart preview" },
]

function YesNoField({
  value,
  onChange,
  label,
  detail,
  detailValue,
  onDetailChange,
}: {
  value: PdaYesNo
  onChange: (v: PdaYesNo) => void
  label: string
  detail?: boolean
  detailValue?: string
  onDetailChange?: (v: string) => void
}) {
  return (
    <div className="space-y-2 rounded-lg border border-neutral-100 bg-neutral-50/50 p-3">
      <p className="text-sm text-neutral-800">{label}</p>
      <div className="flex gap-2">
        {(["yes", "no"] as const).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
              value === opt
                ? "border-primary-500 bg-primary-50 text-primary-800"
                : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
            )}
          >
            {opt}
          </button>
        ))}
      </div>
      {detail && value === "yes" ? (
        <Input
          value={detailValue ?? ""}
          onChange={(e) => onDetailChange?.(e.target.value)}
          placeholder="If yes, please specify"
          className="text-sm"
        />
      ) : null}
    </div>
  )
}

function Field({
  label,
  children,
  fromSystem,
}: {
  label: string
  children: React.ReactNode
  fromSystem?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-neutral-700">{label}</label>
        {fromSystem ? (
          <Badge variant="outline" className="h-5 text-[10px] text-primary-700">
            From record
          </Badge>
        ) : null}
      </div>
      {children}
    </div>
  )
}

export function PdaIntakeForm({
  value,
  onChange,
  prefillKeys = new Set<string>(),
  findings = [],
  treatmentRows = [],
  readOnlySections = [],
}: {
  value: PdaIntakeResponses
  onChange: (next: PdaIntakeResponses) => void
  prefillKeys?: Set<string>
  findings?: ToothFinding[]
  treatmentRows?: TreatmentTimelineEntry[]
  readOnlySections?: SectionId[]
}) {
  const [section, setSection] = React.useState<SectionId>("patient")
  const isReadOnly = (id: SectionId) => readOnlySections.includes(id)

  const patchPatient = (patch: Partial<PdaIntakeResponses["patient"]>) =>
    onChange({ ...value, patient: { ...value.patient, ...patch } })
  const patchDental = (patch: Partial<PdaIntakeResponses["dental"]>) =>
    onChange({ ...value, dental: { ...value.dental, ...patch } })
  const patchMedical = (patch: Partial<PdaIntakeResponses["medical"]>) =>
    onChange({ ...value, medical: { ...value.medical, ...patch } })

  const sys = (key: string) => prefillKeys.has(key)

  const activeFindings = findings.filter((f) => f.status === "active")

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {SECTIONS.filter((s) => !readOnlySections.includes(s.id) || s.id === "chart").map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              section === s.id
                ? "border-primary-500 bg-primary-50 text-primary-900"
                : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === "patient" && !isReadOnly("patient") ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Last name" fromSystem={sys("patient.lastName")}>
            <Input value={value.patient.lastName} onChange={(e) => patchPatient({ lastName: e.target.value })} />
          </Field>
          <Field label="First name" fromSystem={sys("patient.firstName")}>
            <Input value={value.patient.firstName} onChange={(e) => patchPatient({ firstName: e.target.value })} />
          </Field>
          <Field label="Middle name">
            <Input value={value.patient.middleName} onChange={(e) => patchPatient({ middleName: e.target.value })} />
          </Field>
          <Field label="Birthdate" fromSystem={sys("patient.dateOfBirth")}>
            <Input type="date" value={value.patient.dateOfBirth} onChange={(e) => patchPatient({ dateOfBirth: e.target.value })} />
          </Field>
          <Field label="Sex (M/F)" fromSystem={sys("patient.sex")}>
            <select
              value={value.patient.sex}
              onChange={(e) => patchPatient({ sex: e.target.value })}
              className="flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm"
            >
              <option value="">—</option>
              <option value="M">M</option>
              <option value="F">F</option>
            </select>
          </Field>
          <Field label="Religion">
            <Input value={value.patient.religion} onChange={(e) => patchPatient({ religion: e.target.value })} />
          </Field>
          <Field label="Nationality">
            <Input value={value.patient.nationality} onChange={(e) => patchPatient({ nationality: e.target.value })} />
          </Field>
          <Field label="Nickname">
            <Input value={value.patient.nickname} onChange={(e) => patchPatient({ nickname: e.target.value })} />
          </Field>
          <Field label="Home address" fromSystem={sys("patient.address")}>
            <Input value={value.patient.address} onChange={(e) => patchPatient({ address: e.target.value })} className="sm:col-span-2" />
          </Field>
          <Field label="Mobile" fromSystem={sys("patient.mobile")}>
            <Input value={value.patient.mobile} onChange={(e) => patchPatient({ mobile: e.target.value })} />
          </Field>
          <Field label="Email" fromSystem={sys("patient.email")}>
            <Input type="email" value={value.patient.email} onChange={(e) => patchPatient({ email: e.target.value })} />
          </Field>
          <Field label="Home phone">
            <Input value={value.patient.homePhone} onChange={(e) => patchPatient({ homePhone: e.target.value })} />
          </Field>
          <Field label="Office phone">
            <Input value={value.patient.officePhone} onChange={(e) => patchPatient({ officePhone: e.target.value })} />
          </Field>
          <Field label="Occupation">
            <Input value={value.patient.occupation} onChange={(e) => patchPatient({ occupation: e.target.value })} />
          </Field>
          <Field label="Parent / guardian name" fromSystem={sys("patient.guardianName")}>
            <Input value={value.patient.guardianName} onChange={(e) => patchPatient({ guardianName: e.target.value })} />
          </Field>
          <Field label="Guardian occupation">
            <Input value={value.patient.guardianOccupation} onChange={(e) => patchPatient({ guardianOccupation: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Referral source">
              <Input value={value.patient.referralSource} onChange={(e) => patchPatient({ referralSource: e.target.value })} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Reason for dental consultation">
              <textarea
                value={value.patient.consultationReason}
                onChange={(e) => patchPatient({ consultationReason: e.target.value })}
                rows={3}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>
        </div>
      ) : null}

      {section === "dental" && !isReadOnly("dental") ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Previous dentist">
            <Input value={value.dental.previousDentist} onChange={(e) => patchDental({ previousDentist: e.target.value })} />
          </Field>
          <Field label="Last dental visit">
            <Input type="date" value={value.dental.lastDentalVisit} onChange={(e) => patchDental({ lastDentalVisit: e.target.value })} />
          </Field>
        </div>
      ) : null}

      {section === "medical" && !isReadOnly("medical") ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Physician name">
              <Input value={value.medical.physicianName} onChange={(e) => patchMedical({ physicianName: e.target.value })} />
            </Field>
            <Field label="Specialty">
              <Input value={value.medical.physicianSpecialty} onChange={(e) => patchMedical({ physicianSpecialty: e.target.value })} />
            </Field>
            <Field label="Office address">
              <Input value={value.medical.physicianAddress} onChange={(e) => patchMedical({ physicianAddress: e.target.value })} />
            </Field>
            <Field label="Office number">
              <Input value={value.medical.physicianPhone} onChange={(e) => patchMedical({ physicianPhone: e.target.value })} />
            </Field>
          </div>
          <div className="space-y-3">
            {PDA_MEDICAL_QUESTION_LABELS.map((q) => (
              <YesNoField
                key={q.key}
                label={q.label}
                value={value.medical.questions[q.key] as PdaYesNo}
                onChange={(v) =>
                  patchMedical({
                    questions: { ...value.medical.questions, [q.key]: v },
                  })
                }
                detail={Boolean(q.detailKey)}
                detailValue={q.detailKey ? String(value.medical.questions[q.detailKey] ?? "") : undefined}
                onDetailChange={
                  q.detailKey
                    ? (v) =>
                        patchMedical({
                          questions: { ...value.medical.questions, [q.detailKey!]: v },
                        })
                    : undefined
                }
              />
            ))}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-neutral-700">Allergies</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {PDA_ALLERGY_LABELS.map((a) => (
                <YesNoField
                  key={a.key}
                  label={a.label}
                  value={value.medical.allergies[a.key]}
                  onChange={(v) =>
                    patchMedical({
                      allergies: { ...value.medical.allergies, [a.key]: v },
                    })
                  }
                />
              ))}
            </div>
            <Input
              placeholder="Other allergies"
              value={value.medical.allergyOther}
              onChange={(e) => patchMedical({ allergyOther: e.target.value })}
            />
          </div>
          <Field label="Medications" fromSystem={sys("medical.medications")}>
            <textarea
              value={value.medical.medications}
              onChange={(e) => patchMedical({ medications: e.target.value })}
              rows={2}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Additional notes" fromSystem={sys("medical.notes")}>
            <textarea
              value={value.medical.notes}
              onChange={(e) => patchMedical({ notes: e.target.value })}
              rows={2}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </Field>
        </div>
      ) : null}

      {section === "chart" ? (
        <div className="space-y-4 rounded-xl border border-neutral-200 bg-neutral-50/80 p-4">
          <p className="text-sm text-neutral-600">
            Chart findings and treatment rows sync from the digital odontogram and treatment plan. They appear on the printed PDA form automatically.
          </p>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Active findings</p>
            {activeFindings.length === 0 ? (
              <p className="mt-1 text-sm text-neutral-500">No active tooth findings recorded.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {activeFindings.map((f) => (
                  <li key={`${f.tooth_number}-${f.condition}-${f.restoration_type ?? ""}`}>
                    {formatToothFindingLine(f)}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Treatment rows</p>
            {treatmentRows.length === 0 ? (
              <p className="mt-1 text-sm text-neutral-500">No treatment timeline entries.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {treatmentRows
                  .map((row) => ({ row, line: formatTreatmentTimelineLine(row) }))
                  .filter(({ line }) => line.length > 0)
                  .slice(0, 10)
                  .map(({ row, line }) => (
                    <li key={row.item_id}>{line}</li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
