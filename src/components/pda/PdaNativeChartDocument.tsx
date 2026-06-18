"use client"

import type { MedicalHistoryRecord } from "@/lib/patients/medical-history-service"
import type { PatientRecord } from "@/lib/patients/patient-service"
import type { TreatmentTimelineEntry } from "@/lib/clinical/treatment-plan-service"
import type { ToothFinding } from "@/lib/types/dental"
import type { PdaIntakeResponses } from "@/lib/pda/pda-intake-schema"
import { formatTreatmentDescriptionPlain, printableTreatmentRows } from "@/lib/odontogram/clinical-display"
import {
  PDA_ALLERGY_OPTIONS,
  PDA_CONDITION_CHECKLIST,
  PDA_CONSENT_SECTIONS,
  PDA_LEGEND_CONDITION,
  PDA_LEGEND_RESTORATION,
  PDA_LEGEND_SURGERY,
  PDA_LOWER_PERMANENT,
  PDA_LOWER_PRIMARY,
  PDA_MEDICAL_HISTORY_QUESTIONS,
  PDA_UPPER_PERMANENT,
  PDA_UPPER_PRIMARY,
  PDA_WOMEN_OPTIONS,
} from "@/lib/pda/pda-print-constants"
import {
  conditionMatches,
  formatPdaDate,
  formatPdaName,
  formatPdaPeso,
  getPdaAge,
  pdaGenderLabel,
  pdaToothCode,
  textIncludes,
} from "@/lib/pda/pda-print-utils"

function Field({
  label,
  value,
  width,
  grow,
}: {
  label: string
  value: string
  width?: string
  grow?: boolean
}) {
  return (
    <span className={`pda-native-field${grow ? " pda-native-field-grow" : ""}`}>
      <span className="pda-native-field-label">{label}</span>
      <span className="pda-native-field-value" style={width ? { minWidth: width } : undefined}>
        {value || "\u00a0"}
      </span>
    </span>
  )
}

function Check({ checked }: { checked: boolean }) {
  return <span className="pda-native-check-box">{checked ? "✓" : ""}</span>
}

function YesNoRow({ text, yes, no }: { text: string; yes: boolean; no: boolean }) {
  return (
    <div className="pda-native-yn-row">
      <span>{text}</span>
      <span className="pda-native-yn-mark">{yes ? "✓" : ""}</span>
      <span className="pda-native-yn-mark">{no ? "✓" : ""}</span>
    </div>
  )
}

function ToothChartRow({
  label,
  numbers,
  codes,
  columns = 16,
}: {
  label: string
  numbers: string[]
  codes: Record<string, string>
  columns?: 10 | 16
}) {
  const cells = [...numbers]
  while (cells.length < columns) cells.push("")
  return (
    <>
      <div className={`pda-native-tooth-row${columns === 10 ? " cols-10" : ""}`}>
        <span className="pda-native-tooth-row-label">{label}</span>
        {cells.map((n, i) => (
          <span key={`${label}-num-${n || i}`} className="pda-native-tooth-num">
            {n}
          </span>
        ))}
      </div>
      <div className={`pda-native-tooth-row${columns === 10 ? " cols-10" : ""}`}>
        <span className="pda-native-tooth-row-label" />
        {cells.map((n, i) => (
          <span key={`${label}-code-${n || i}`} className="pda-native-tooth-code">
            {n ? (codes[n] ?? "") : ""}
          </span>
        ))}
      </div>
    </>
  )
}

export function PdaNativeChartDocument({
  patient,
  medicalHistory,
  responses,
  findings = [],
  treatmentRows = [],
  dentistName,
  printedDate = new Date(),
  printRootId = "pda-intake-print",
}: {
  patient: PatientRecord | null
  medicalHistory?: MedicalHistoryRecord | null
  responses?: PdaIntakeResponses | null
  findings?: ToothFinding[]
  treatmentRows?: TreatmentTimelineEntry[]
  dentistName?: string | null
  printedDate?: Date
  printRootId?: string
}) {
  const p = responses?.patient
  const d = responses?.dental
  const m = responses?.medical
  const dob = p?.dateOfBirth ?? patient?.date_of_birth ?? ""
  const name = formatPdaName(responses, patient)
  const age = getPdaAge(dob)
  const gender = p?.sex || pdaGenderLabel(patient?.gender)
  const dateLabel = formatPdaDate(printedDate.toISOString())

  const activeFindings = findings.filter((f) => f.status === "active")
  const codeByTooth = Object.fromEntries(
    activeFindings
      .map((f) => [f.tooth_number, pdaToothCode(f)] as const)
      .filter(([, code]) => code)
  )

  const rows = printableTreatmentRows(treatmentRows)
  const emptyTreatmentRows = Math.max(0, 32 - rows.length)

  const q = m?.questions
  const allergyYes = (key: (typeof PDA_ALLERGY_OPTIONS)[number]["key"]) =>
    m?.allergies[key] === "yes" ||
    textIncludes(medicalHistory?.allergies, [key === "lidocaine" ? "anesthetic" : key])

  const questionYes = (key: string) => {
    const val = q?.[key as keyof typeof q]
    return val === "yes"
  }

  const questionNo = (key: string) => {
    const val = q?.[key as keyof typeof q]
    return val === "no"
  }

  return (
    <div id={printRootId} className="pda-native-root">
      {/* Page 1 — Patient information record */}
      <section className="pda-native-sheet pda-native-sheet--intake" aria-label="PDA page 1">
        <div className="pda-native-header" role="banner">
          <div className="pda-native-logo">PDA</div>
          <div className="pda-native-title-block">
            <h1 className="pda-native-org">PHILIPPINE DENTAL ASSOCIATION</h1>
            <div className="pda-native-pill">DENTAL CHART</div>
          </div>
          <div className="pda-native-photo-box" aria-hidden />
        </div>

        <h2 className="pda-native-section-title">Patient Information Record</h2>
        <div className="pda-native-row pda-native-row--name">
          <Field label="Name:" value="" width="0.45in" />
          <Field label="Last" value={p?.lastName ?? patient?.last_name ?? ""} width="1.35in" />
          <Field label="First" value={p?.firstName ?? patient?.first_name ?? ""} width="1.35in" />
          <Field label="Middle" value={p?.middleName ?? ""} width="1.1in" />
        </div>
        <div className="pda-native-row">
          <Field label="Birthdate(mm/dd/yy)" value={formatPdaDate(dob)} width="0.9in" />
          <Field label="Age" value={age} width="0.35in" />
          <Field label="Sex: M/F" value={gender} width="0.35in" />
          <Field label="Religion" value={p?.religion ?? ""} width="0.9in" />
          <Field label="Nationality" value={p?.nationality ?? ""} width="0.9in" />
          <Field label="Nickname" value={p?.nickname ?? ""} width="0.9in" />
        </div>
        <div className="pda-native-row">
          <Field label="Home Address" value={p?.address ?? patient?.address ?? ""} grow />
        </div>
        <div className="pda-native-row">
          <Field label="Home No." value={p?.homePhone ?? ""} width="0.8in" />
          <Field label="Occupation" value={p?.occupation ?? ""} width="1.2in" />
          <Field label="Office No." value={p?.officePhone ?? ""} width="0.8in" />
          <Field label="Fax No." value={p?.fax ?? ""} width="0.8in" />
        </div>
        <div className="pda-native-row">
          <Field label="Cel/Mobile No." value={p?.mobile ?? patient?.phone ?? ""} width="1in" />
          <Field label="Email Add" value={p?.email ?? patient?.email ?? ""} width="1.5in" />
        </div>
        <div className="pda-native-row">
          <Field label="Dental Insurance" value="" width="1.2in" />
          <Field label="Effective Date" value="" width="0.9in" />
        </div>
        <div className="pda-native-row">
          <Field label="For minors: Parent/Guardian&apos;s Name" value={p?.guardianName ?? ""} grow />
          <Field label="Occupation" value={p?.guardianOccupation ?? ""} width="1.2in" />
        </div>
        <div className="pda-native-row">
          <Field label="Whom may we thank for referring you?" value={p?.referralSource ?? ""} grow />
        </div>
        <div className="pda-native-row">
          <Field label="What is your reason for dental consultation?" value={p?.consultationReason ?? ""} grow />
        </div>

        <h2 className="pda-native-section-title">Dental History</h2>
        <div className="pda-native-row">
          <Field label="Previous Dentist: Dr." value={d?.previousDentist ?? ""} width="2in" />
          <Field label="Last Dental visit:" value={formatPdaDate(d?.lastDentalVisit)} width="1in" />
        </div>

        <h2 className="pda-native-section-title">Medical History</h2>
        <div className="pda-native-row">
          <Field label="Name of Physician: Dr." value={m?.physicianName ?? ""} width="1.6in" />
          <Field label="Specialty, if applicable:" value={m?.physicianSpecialty ?? ""} width="1.2in" />
        </div>
        <div className="pda-native-row">
          <Field label="Office Address:" value={m?.physicianAddress ?? ""} grow />
          <Field label="Office Number:" value={m?.physicianPhone ?? ""} width="1in" />
        </div>

        <div className="pda-native-yn-header">
          <span />
          <span>Yes</span>
          <span>No</span>
        </div>

        {PDA_MEDICAL_HISTORY_QUESTIONS.map((item) => {
          if (item.num === 8) {
            return (
              <div key={item.num}>
                <p className="pda-native-allergy-intro">
                  8. {item.text}
                </p>
                <div className="pda-native-allergy-grid">
                  {PDA_ALLERGY_OPTIONS.map((a) => (
                    <span key={a.key} className="pda-native-check">
                      <Check checked={allergyYes(a.key)} />
                      {a.label}
                    </span>
                  ))}
                  <span className="pda-native-check">
                    <Check checked={Boolean(m?.allergyOther?.trim())} />
                    Others: {m?.allergyOther ?? ""}
                  </span>
                </div>
              </div>
            )
          }
          if (item.womenOnly) {
            return (
              <div key={item.num} className="pda-native-women-row">
                <span>10. {item.text}</span>
                {PDA_WOMEN_OPTIONS.map((opt) => (
                  <span key={opt} className="pda-native-check">
                    <Check checked={false} />
                    {opt}
                  </span>
                ))}
              </div>
            )
          }
          if (item.num === 9) {
            return (
              <div key={item.num} className="pda-native-row pda-native-row--tight">
                <Field label="9. Bleeding Time" value={m?.bleedingTime ?? ""} width="1.2in" />
              </div>
            )
          }
          if (item.num === 11) {
            return (
              <div key={item.num} className="pda-native-row pda-native-row--tight">
                <Field label="11. Blood Type" value={m?.bloodType ?? ""} width="1.2in" />
              </div>
            )
          }
          if (item.num === 12) {
            return (
              <div key={item.num} className="pda-native-row pda-native-row--tight">
                <Field label="12. Blood Pressure" value={m?.bloodPressure ?? ""} width="1.2in" />
              </div>
            )
          }
          const keyMap: Record<number, string> = {
            1: "good_health",
            2: "under_treatment",
            3: "serious_illness",
            4: "hospitalized",
            5: "taking_medication",
          }
          const key = keyMap[item.num]
          const detailKey =
            item.num === 2
              ? "under_treatment_detail"
              : item.num === 3
                ? "serious_illness_detail"
                : item.num === 4
                  ? "hospitalized_detail"
                  : null
          if (item.num === 6 || item.num === 7) {
            return (
              <YesNoRow key={item.num} text={`${item.num}. ${item.text}`} yes={false} no={false} />
            )
          }
          return (
            <div key={item.num}>
              <YesNoRow
                text={`${item.num}. ${item.text}`}
                yes={key ? questionYes(key) : false}
                no={key ? questionNo(key) : false}
              />
              {detailKey && q?.[detailKey] ? (
                <div className="pda-native-row" style={{ marginLeft: 12 }}>
                  <Field label={item.detail ?? ""} value={String(q[detailKey])} grow />
                </div>
              ) : item.num === 5 && (m?.medications || medicalHistory?.medications?.length) ? (
                <div className="pda-native-row" style={{ marginLeft: 12 }}>
                  <Field
                    label="If so, please specify"
                    value={m?.medications ?? medicalHistory?.medications?.join(", ") ?? ""}
                    grow
                  />
                </div>
              ) : null}
            </div>
          )
        })}

        <p className="pda-native-q13-title">
          13. Do you have or have you ever had any of the following? Check which apply
        </p>
        <div className="pda-native-condition-grid">
          {PDA_CONDITION_CHECKLIST.map((item) => {
            const checked =
              conditionMatches(item.patterns, responses, medicalHistory) ||
              (item.label.includes("High Blood") && questionYes("hypertension")) ||
              (item.label.includes("Low Blood") && questionYes("hypotension")) ||
              (item.label.includes("Epilepsy") && questionYes("epilepsy")) ||
              (item.label.includes("Heart Disease") && questionYes("heart_disease")) ||
              (item.label.includes("Hepatitis") && questionYes("hepatitis")) ||
              (item.label.includes("Diabetes") && questionYes("diabetes")) ||
              (item.label.includes("Cancer") && questionYes("cancer")) ||
              (item.label.includes("Asthma") && questionYes("asthma"))
            return (
              <span key={item.label} className="pda-native-check">
                <Check checked={checked} />
                {item.label}
              </span>
            )
          })}
        </div>

        <div className="pda-native-signature-row">
          <Field label="Signature" value="" width="2.4in" />
        </div>
      </section>

      {/* Page 2 — Informed consent */}
      <section className="pda-native-sheet" aria-label="PDA page 2">
        <div className="pda-native-title-block pda-native-consent-title">
          <div className="pda-native-pill">INFORMED CONSENT</div>
        </div>
        {PDA_CONSENT_SECTIONS.map((section) => (
          <div key={section.title} className="pda-native-consent-section">
            <h3>{section.title}</h3>
            <p>{section.body}</p>
            <p className="pda-native-initial-line">(Initial: _____________)</p>
          </div>
        ))}
        <p style={{ fontSize: "6.8pt", textAlign: "justify", marginTop: 6 }}>
          I understand that dentistry is not an exact science and that no dentist can properly guarantee
          accurate results all the time. I authorize the dentist to perform the dental restorations and
          treatments as explained to me. I understand that I am financially responsible for all services.
        </p>
        <div className="pda-native-signatures">
          <div>
            <div className="pda-native-sign-line" />
            <span>Patient / Parent / Guardian Signature</span>
          </div>
          <div>
            <div className="pda-native-sign-line" />
            <span>Dentist / Signature</span>
          </div>
          <div>
            <div className="pda-native-sign-line" />
            <span>Date</span>
          </div>
        </div>
      </section>

      {/* Page 3 — Dental record chart */}
      <section className="pda-native-sheet" aria-label="PDA page 3">
        <div className="pda-native-title-block" style={{ marginBottom: 6 }}>
          <div className="pda-native-pill">DENTAL RECORD CHART</div>
        </div>
        <div className="pda-native-chart-head">
          <strong>INTRAORAL EXAMINATION</strong>
          <Field label="Name:" value={name} width="1.8in" />
          <Field label="Age:" value={age} width="0.35in" />
          <Field label="Gender :M/F" value={gender} width="0.35in" />
          <Field label="Date:" value={dateLabel} width="0.7in" />
        </div>
        <div className="pda-native-chart-grid">
          <div className="pda-native-chart-quadrant-labels">
            <span>RIGHT</span>
            <span>LEFT</span>
          </div>
          <ToothChartRow label="TEMP" numbers={PDA_UPPER_PRIMARY} codes={codeByTooth} columns={10} />
          <ToothChartRow label="PERM" numbers={PDA_UPPER_PERMANENT} codes={codeByTooth} columns={16} />
          <ToothChartRow label="PERM" numbers={PDA_LOWER_PERMANENT} codes={codeByTooth} columns={16} />
          <ToothChartRow label="TEMP" numbers={PDA_LOWER_PRIMARY} codes={codeByTooth} columns={10} />
        </div>
        <div className="pda-native-legend">
          <div>
            <h4>Legend: Condition</h4>
            <ul>
              {PDA_LEGEND_CONDITION.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Restorations &amp; Prosthetics</h4>
            <ul>
              {PDA_LEGEND_RESTORATION.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Surgery &amp; X-ray Taken</h4>
            <ul>
              {PDA_LEGEND_SURGERY.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Page 4 — Treatment record */}
      <section className="pda-native-sheet" aria-label="PDA page 4">
        <div className="pda-native-row" style={{ marginBottom: 4 }}>
          <Field label="Name:" value={name} width="2.5in" />
          <Field label="Age:" value={age} width="0.35in" />
          <Field label="Gender: M/F" value={gender} width="0.35in" />
        </div>
        <div className="pda-native-title-block" style={{ marginBottom: 4 }}>
          <div className="pda-native-pill">TREATMENT RECORD</div>
        </div>
        <table className="pda-native-treatment-table">
          <thead>
            <tr>
              <th className="col-date">Date</th>
              <th className="col-tooth">Tooth No./s</th>
              <th className="col-proc">Procedure</th>
              <th className="col-dentist">Dentist/s</th>
              <th className="col-money">Amount charged</th>
              <th className="col-money">Amount Paid</th>
              <th className="col-money">Balance</th>
              <th className="col-date">Next Appt.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.item_id}>
                <td>{formatPdaDate(row.item_created_at)}</td>
                <td>{row.tooth_number ?? ""}</td>
                <td>{formatTreatmentDescriptionPlain(row.description, row.tooth_number)}</td>
                <td>{dentistName ?? ""}</td>
                <td>{formatPdaPeso(row.estimated_price)}</td>
                <td />
                <td />
                <td />
              </tr>
            ))}
            {Array.from({ length: emptyTreatmentRows }).map((_, i) => (
              <tr key={`empty-${i}`}>
                <td>&nbsp;</td>
                <td />
                <td />
                <td />
                <td />
                <td />
                <td />
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
