"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useLocale } from "@/hooks/use-locale"
import {
  type PdaIntakeResponses,
  type PdaYesNo,
} from "@/lib/pda/pda-intake-schema"
import {
  getPdaAllergyLabels,
  getPdaMedicalQuestionLabels,
  getPdaSections,
  getPdaYesNoLabels,
  pdaFieldLabel,
  PDA_FIELD_KEYS,
  type PdaSectionId,
} from "@/lib/pda/pda-intake-i18n"
import type { ToothFinding } from "@/lib/types/dental"
import type { TreatmentTimelineEntry } from "@/lib/clinical/treatment-plan-service"
import {
  formatToothFindingLine,
  formatTreatmentTimelineLine,
} from "@/lib/odontogram/clinical-display"

type SectionId = PdaSectionId

function YesNoField({
  value,
  onChange,
  label,
  detail,
  detailValue,
  onDetailChange,
  yesLabel,
  noLabel,
  specifyPlaceholder,
}: {
  value: PdaYesNo
  onChange: (v: PdaYesNo) => void
  label: string
  detail?: boolean
  detailValue?: string
  onDetailChange?: (v: string) => void
  yesLabel: string
  noLabel: string
  specifyPlaceholder: string
}) {
  return (
    <div className="space-y-2 rounded-lg border border-neutral-100 bg-neutral-50/50 p-3">
      <p className="text-sm text-neutral-800">{label}</p>
      <div className="flex gap-2">
        {(
          [
            { opt: "yes" as const, text: yesLabel },
            { opt: "no" as const, text: noLabel },
          ] as const
        ).map(({ opt, text }) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              value === opt
                ? "border-primary-500 bg-primary-50 text-primary-800"
                : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
            )}
          >
            {text}
          </button>
        ))}
      </div>
      {detail && value === "yes" ? (
        <Input
          value={detailValue ?? ""}
          onChange={(e) => onDetailChange?.(e.target.value)}
          placeholder={specifyPlaceholder}
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
  fromSystemLabel,
}: {
  label: string
  children: React.ReactNode
  fromSystem?: boolean
  fromSystemLabel: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-neutral-700">{label}</label>
        {fromSystem ? (
          <Badge variant="outline" className="h-5 text-[10px] text-primary-700">
            {fromSystemLabel}
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
  const { t } = useLocale()
  const sections = React.useMemo(() => getPdaSections(t), [t])
  const medicalQuestions = React.useMemo(() => getPdaMedicalQuestionLabels(t), [t])
  const allergyLabels = React.useMemo(() => getPdaAllergyLabels(t), [t])
  const yn = React.useMemo(() => getPdaYesNoLabels(t), [t])
  const fl = (key: keyof typeof PDA_FIELD_KEYS) => pdaFieldLabel(t, key, PDA_FIELD_KEYS[key])

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
        {sections.filter((s) => !readOnlySections.includes(s.id) || s.id === "chart").map((s) => (
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
          <Field label={fl("lastName")} fromSystem={sys("patient.lastName")} fromSystemLabel={yn.fromRecord}>
            <Input value={value.patient.lastName} onChange={(e) => patchPatient({ lastName: e.target.value })} />
          </Field>
          <Field label={fl("firstName")} fromSystem={sys("patient.firstName")} fromSystemLabel={yn.fromRecord}>
            <Input value={value.patient.firstName} onChange={(e) => patchPatient({ firstName: e.target.value })} />
          </Field>
          <Field label={fl("middleName")} fromSystemLabel={yn.fromRecord}>
            <Input value={value.patient.middleName} onChange={(e) => patchPatient({ middleName: e.target.value })} />
          </Field>
          <Field label={fl("dateOfBirth")} fromSystem={sys("patient.dateOfBirth")} fromSystemLabel={yn.fromRecord}>
            <Input type="date" value={value.patient.dateOfBirth} onChange={(e) => patchPatient({ dateOfBirth: e.target.value })} />
          </Field>
          <Field label={fl("sex")} fromSystem={sys("patient.sex")} fromSystemLabel={yn.fromRecord}>
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
          <Field label={fl("religion")} fromSystemLabel={yn.fromRecord}>
            <Input value={value.patient.religion} onChange={(e) => patchPatient({ religion: e.target.value })} />
          </Field>
          <Field label={fl("nationality")} fromSystemLabel={yn.fromRecord}>
            <Input value={value.patient.nationality} onChange={(e) => patchPatient({ nationality: e.target.value })} />
          </Field>
          <Field label={fl("nickname")} fromSystemLabel={yn.fromRecord}>
            <Input value={value.patient.nickname} onChange={(e) => patchPatient({ nickname: e.target.value })} />
          </Field>
          <Field label={fl("address")} fromSystem={sys("patient.address")} fromSystemLabel={yn.fromRecord}>
            <Input value={value.patient.address} onChange={(e) => patchPatient({ address: e.target.value })} className="sm:col-span-2" />
          </Field>
          <Field label={fl("mobile")} fromSystem={sys("patient.mobile")} fromSystemLabel={yn.fromRecord}>
            <Input value={value.patient.mobile} onChange={(e) => patchPatient({ mobile: e.target.value })} />
          </Field>
          <Field label={fl("email")} fromSystem={sys("patient.email")} fromSystemLabel={yn.fromRecord}>
            <Input type="email" value={value.patient.email} onChange={(e) => patchPatient({ email: e.target.value })} />
          </Field>
          <Field label={fl("homePhone")} fromSystemLabel={yn.fromRecord}>
            <Input value={value.patient.homePhone} onChange={(e) => patchPatient({ homePhone: e.target.value })} />
          </Field>
          <Field label={fl("officePhone")} fromSystemLabel={yn.fromRecord}>
            <Input value={value.patient.officePhone} onChange={(e) => patchPatient({ officePhone: e.target.value })} />
          </Field>
          <Field label={fl("occupation")} fromSystemLabel={yn.fromRecord}>
            <Input value={value.patient.occupation} onChange={(e) => patchPatient({ occupation: e.target.value })} />
          </Field>
          <Field label={fl("guardianName")} fromSystem={sys("patient.guardianName")} fromSystemLabel={yn.fromRecord}>
            <Input value={value.patient.guardianName} onChange={(e) => patchPatient({ guardianName: e.target.value })} />
          </Field>
          <Field label={fl("guardianOccupation")} fromSystemLabel={yn.fromRecord}>
            <Input value={value.patient.guardianOccupation} onChange={(e) => patchPatient({ guardianOccupation: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label={fl("referralSource")} fromSystemLabel={yn.fromRecord}>
              <Input value={value.patient.referralSource} onChange={(e) => patchPatient({ referralSource: e.target.value })} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={fl("consultationReason")} fromSystemLabel={yn.fromRecord}>
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
          <Field label={fl("previousDentist")} fromSystemLabel={yn.fromRecord}>
            <Input value={value.dental.previousDentist} onChange={(e) => patchDental({ previousDentist: e.target.value })} />
          </Field>
          <Field label={fl("lastDentalVisit")} fromSystemLabel={yn.fromRecord}>
            <Input type="date" value={value.dental.lastDentalVisit} onChange={(e) => patchDental({ lastDentalVisit: e.target.value })} />
          </Field>
        </div>
      ) : null}

      {section === "medical" && !isReadOnly("medical") ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={fl("physicianName")} fromSystemLabel={yn.fromRecord}>
              <Input value={value.medical.physicianName} onChange={(e) => patchMedical({ physicianName: e.target.value })} />
            </Field>
            <Field label={fl("physicianSpecialty")} fromSystemLabel={yn.fromRecord}>
              <Input value={value.medical.physicianSpecialty} onChange={(e) => patchMedical({ physicianSpecialty: e.target.value })} />
            </Field>
            <Field label={fl("physicianAddress")} fromSystemLabel={yn.fromRecord}>
              <Input value={value.medical.physicianAddress} onChange={(e) => patchMedical({ physicianAddress: e.target.value })} />
            </Field>
            <Field label={fl("physicianPhone")} fromSystemLabel={yn.fromRecord}>
              <Input value={value.medical.physicianPhone} onChange={(e) => patchMedical({ physicianPhone: e.target.value })} />
            </Field>
            <Field label={fl("bleedingTime")} fromSystemLabel={yn.fromRecord}>
              <Input value={value.medical.bleedingTime} onChange={(e) => patchMedical({ bleedingTime: e.target.value })} />
            </Field>
            <Field label={fl("bloodType")} fromSystemLabel={yn.fromRecord}>
              <Input value={value.medical.bloodType} onChange={(e) => patchMedical({ bloodType: e.target.value })} />
            </Field>
            <Field label={fl("bloodPressure")} fromSystemLabel={yn.fromRecord}>
              <Input value={value.medical.bloodPressure} onChange={(e) => patchMedical({ bloodPressure: e.target.value })} />
            </Field>
          </div>
          <div className="space-y-3">
            {medicalQuestions.map((q) => (
              <YesNoField
                key={q.key}
                label={q.label}
                yesLabel={yn.yes}
                noLabel={yn.no}
                specifyPlaceholder={yn.specify}
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
            <p className="text-xs font-medium text-neutral-700">{yn.allergies}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {allergyLabels.map((a) => (
                <YesNoField
                  key={a.key}
                  label={a.label}
                  yesLabel={yn.yes}
                  noLabel={yn.no}
                  specifyPlaceholder={yn.specify}
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
              placeholder={yn.otherAllergies}
              value={value.medical.allergyOther}
              onChange={(e) => patchMedical({ allergyOther: e.target.value })}
            />
          </div>
          <Field label={fl("medications")} fromSystem={sys("medical.medications")} fromSystemLabel={yn.fromRecord}>
            <textarea
              value={value.medical.medications}
              onChange={(e) => patchMedical({ medications: e.target.value })}
              rows={2}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label={fl("notes")} fromSystem={sys("medical.notes")} fromSystemLabel={yn.fromRecord}>
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
          <p className="text-sm text-neutral-600">{yn.chartIntro}</p>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{yn.activeFindings}</p>
            {activeFindings.length === 0 ? (
              <p className="mt-1 text-sm text-neutral-500">{yn.noFindings}</p>
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
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{yn.treatmentRows}</p>
            {treatmentRows.length === 0 ? (
              <p className="mt-1 text-sm text-neutral-500">{yn.noTreatmentRows}</p>
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
