"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { PdaYesNo } from "@/lib/pda/pda-intake-schema"
import {
  getPdaAllergyLabels,
  getPdaMedicalQuestionLabels,
  getPdaYesNoLabels,
  pdaFieldLabel,
  PDA_FIELD_KEYS,
} from "@/lib/pda/pda-intake-i18n"
import type { PatientIntakeProfile } from "@/lib/patients/patient-intake-profile"
import { useLocale } from "@/hooks/use-locale"
import { cn } from "@/lib/utils"

function YesNoSelect({
  value,
  onChange,
  label,
  yesLabel,
  noLabel,
}: {
  value: PdaYesNo
  onChange: (v: PdaYesNo) => void
  label: string
  yesLabel: string
  noLabel: string
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
        <option value="yes">{yesLabel}</option>
        <option value="no">{noLabel}</option>
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
  const { t } = useLocale()
  const yn = React.useMemo(() => getPdaYesNoLabels(t), [t])
  const medicalQuestions = React.useMemo(() => getPdaMedicalQuestionLabels(t), [t])
  const allergyLabels = React.useMemo(() => getPdaAllergyLabels(t), [t])
  const fl = (key: keyof typeof PDA_FIELD_KEYS) => pdaFieldLabel(t, key, PDA_FIELD_KEYS[key])

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
        <CardTitle>{t("pda.intakeTitle", "PDA intake details")}</CardTitle>
        <CardDescription>
          {t(
            "pda.intakeDesc",
            "Extra fields for the official PDA dental chart. These auto-fill when you open or print the PDA form."
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-neutral-900">
            {t("pda.demoSection", "Demographics & contact")}
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={fl("middleName")}>
              <Input value={value.middleName ?? ""} onChange={(e) => patch({ middleName: e.target.value })} />
            </Field>
            <Field label={fl("nickname")}>
              <Input value={value.nickname ?? ""} onChange={(e) => patch({ nickname: e.target.value })} />
            </Field>
            <Field label={fl("religion")}>
              <Input value={value.religion ?? ""} onChange={(e) => patch({ religion: e.target.value })} />
            </Field>
            <Field label={fl("nationality")}>
              <Input value={value.nationality ?? ""} onChange={(e) => patch({ nationality: e.target.value })} />
            </Field>
            <Field label={fl("occupation")}>
              <Input value={value.occupation ?? ""} onChange={(e) => patch({ occupation: e.target.value })} />
            </Field>
            <Field label={fl("homePhone")}>
              <Input value={value.homePhone ?? ""} onChange={(e) => patch({ homePhone: e.target.value })} />
            </Field>
            <Field label={fl("officePhone")}>
              <Input value={value.officePhone ?? ""} onChange={(e) => patch({ officePhone: e.target.value })} />
            </Field>
            <Field label={fl("fax")}>
              <Input value={value.fax ?? ""} onChange={(e) => patch({ fax: e.target.value })} />
            </Field>
            <Field label={fl("guardianOccupation")}>
              <Input
                value={value.guardianOccupation ?? ""}
                onChange={(e) => patch({ guardianOccupation: e.target.value })}
              />
            </Field>
            <Field label={fl("referralSource")} className="md:col-span-2">
              <Input value={value.referralSource ?? ""} onChange={(e) => patch({ referralSource: e.target.value })} />
            </Field>
            <Field label={fl("consultationReason")} className="md:col-span-2">
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
          <h3 className="text-sm font-semibold text-neutral-900">{t("pda.dentalHistorySection", "Dental history")}</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={fl("previousDentist")}>
              <Input
                value={value.previousDentist ?? ""}
                onChange={(e) => patch({ previousDentist: e.target.value })}
              />
            </Field>
            <Field label={fl("lastDentalVisit")}>
              <Input
                type="date"
                value={value.lastDentalVisit ?? ""}
                onChange={(e) => patch({ lastDentalVisit: e.target.value })}
              />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-neutral-900">{t("pda.physicianSection", "Physician & vitals")}</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={fl("physicianName")}>
              <Input value={value.physicianName ?? ""} onChange={(e) => patch({ physicianName: e.target.value })} />
            </Field>
            <Field label={fl("physicianSpecialty")}>
              <Input
                value={value.physicianSpecialty ?? ""}
                onChange={(e) => patch({ physicianSpecialty: e.target.value })}
              />
            </Field>
            <Field label={fl("physicianAddress")} className="md:col-span-2">
              <Input
                value={value.physicianAddress ?? ""}
                onChange={(e) => patch({ physicianAddress: e.target.value })}
              />
            </Field>
            <Field label={fl("physicianPhone")}>
              <Input value={value.physicianPhone ?? ""} onChange={(e) => patch({ physicianPhone: e.target.value })} />
            </Field>
            <Field label={fl("bleedingTime")}>
              <Input value={value.bleedingTime ?? ""} onChange={(e) => patch({ bleedingTime: e.target.value })} />
            </Field>
            <Field label={fl("bloodType")}>
              <Input value={value.bloodType ?? ""} onChange={(e) => patch({ bloodType: e.target.value })} />
            </Field>
            <Field label={fl("bloodPressure")}>
              <Input value={value.bloodPressure ?? ""} onChange={(e) => patch({ bloodPressure: e.target.value })} />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-neutral-900">{t("pda.medicalSection", "Medical questionnaire (PDA)")}</h3>
          <p className="text-xs text-neutral-500">{t("pda.medicalHint", "Allergies, medications, and conditions on the Medical history page also feed the PDA form.")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {medicalQuestions.map((item) => (
              <React.Fragment key={item.key}>
                <YesNoSelect
                  label={item.label}
                  yesLabel={yn.yes}
                  noLabel={yn.no}
                  value={(q[item.key] as PdaYesNo) ?? ""}
                  onChange={(v) => patchQuestion(item.key, v)}
                />
                {item.detailKey && q[item.key] === "yes" ? (
                  <Field label={t("pda.details", "Details")} className="sm:col-span-2">
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
            {allergyLabels.map((item) => (
              <YesNoSelect
                key={item.key}
                label={item.label}
                yesLabel={yn.yes}
                noLabel={yn.no}
                value={value.allergyFlags?.[item.key] ?? ""}
                onChange={(v) => patchAllergy(item.key, v)}
              />
            ))}
          </div>
          <Field label={yn.otherAllergies}>
            <Input value={value.allergyOther ?? ""} onChange={(e) => patch({ allergyOther: e.target.value })} />
          </Field>
        </section>
      </CardContent>
    </Card>
  )
}
