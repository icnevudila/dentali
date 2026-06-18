"use client"

import Image from "next/image"
import type { PatientRecord } from "@/lib/patients/patient-service"
import type { MedicalHistoryRecord } from "@/lib/patients/medical-history-service"
import type { TreatmentTimelineEntry } from "@/lib/clinical/treatment-plan-service"
import type { ToothFinding } from "@/lib/types/dental"

const PDA_PAGE_IMAGES = [
  "/forms/pda-dental-chart/page-1.png",
  "/forms/pda-dental-chart/page-2.png",
  "/forms/pda-dental-chart/page-3.png",
  "/forms/pda-dental-chart/page-4.png",
]

function formatDate(value: string | null | undefined): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-PH", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  })
}

function getAge(value: string | null | undefined): string {
  if (!value) return ""
  const birthDate = new Date(value)
  if (Number.isNaN(birthDate.getTime())) return ""
  const now = new Date()
  let age = now.getFullYear() - birthDate.getFullYear()
  const monthDelta = now.getMonth() - birthDate.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birthDate.getDate())) age -= 1
  return age > 0 ? String(age) : ""
}

function genderLabel(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) return ""
  if (normalized.startsWith("m")) return "M"
  if (normalized.startsWith("f")) return "F"
  return value ?? ""
}

function fullName(patient: PatientRecord | null): string {
  if (!patient) return ""
  return `${patient.last_name}, ${patient.first_name}`.trim()
}

function textIncludes(items: string[] | undefined, patterns: string[]): boolean {
  const text = (items ?? []).join(" ").toLowerCase()
  return patterns.some((pattern) => text.includes(pattern))
}

function toothCode(finding: ToothFinding): string {
  if (finding.condition === "decayed") return "D"
  if (finding.condition === "missing_caries") return "M"
  if (finding.condition === "missing_other") return "MO"
  if (finding.condition === "impacted") return "Im"
  if (finding.condition === "supernumerary") return "Sp"
  if (finding.condition === "root_fragment") return "Rf"
  if (finding.condition === "unerupted") return "Un"
  if (finding.condition === "indicated_extraction") return "X"
  if (finding.restoration_type === "amalgam") return "Am"
  if (finding.restoration_type === "composite") return "Co"
  if (finding.restoration_type === "jacket_crown") return "JC"
  if (finding.restoration_type === "abutment") return "Ab"
  if (finding.restoration_type === "pontic") return "P"
  if (finding.restoration_type === "inlay") return "In"
  if (finding.restoration_type === "implant") return "Imp"
  if (finding.restoration_type === "sealant") return "S"
  if (finding.restoration_type === "removable_denture") return "Rm"
  if (finding.surgery_type === "extraction_caries") return "X"
  if (finding.surgery_type === "extraction_other") return "XO"
  return ""
}

const PERMANENT_TOOTH_POSITIONS: Record<string, { left: string; top: string }> = {
  "18": { left: "23.7%", top: "35.8%" },
  "17": { left: "28%", top: "35.8%" },
  "16": { left: "32.4%", top: "35.8%" },
  "15": { left: "36.9%", top: "35.8%" },
  "14": { left: "41.1%", top: "35.8%" },
  "13": { left: "45.6%", top: "35.8%" },
  "12": { left: "50%", top: "35.8%" },
  "11": { left: "54.4%", top: "35.8%" },
  "21": { left: "59%", top: "35.8%" },
  "22": { left: "63.4%", top: "35.8%" },
  "23": { left: "67.8%", top: "35.8%" },
  "24": { left: "72.2%", top: "35.8%" },
  "25": { left: "76.5%", top: "35.8%" },
  "26": { left: "80.9%", top: "35.8%" },
  "27": { left: "85.3%", top: "35.8%" },
  "28": { left: "89.6%", top: "35.8%" },
  "48": { left: "23.7%", top: "49.4%" },
  "47": { left: "28%", top: "49.4%" },
  "46": { left: "32.4%", top: "49.4%" },
  "45": { left: "36.9%", top: "49.4%" },
  "44": { left: "41.1%", top: "49.4%" },
  "43": { left: "45.6%", top: "49.4%" },
  "42": { left: "50%", top: "49.4%" },
  "41": { left: "54.4%", top: "49.4%" },
  "31": { left: "59%", top: "49.4%" },
  "32": { left: "63.4%", top: "49.4%" },
  "33": { left: "67.8%", top: "49.4%" },
  "34": { left: "72.2%", top: "49.4%" },
  "35": { left: "76.5%", top: "49.4%" },
  "36": { left: "80.9%", top: "49.4%" },
  "37": { left: "85.3%", top: "49.4%" },
  "38": { left: "89.6%", top: "49.4%" },
}

function peso(value: number | null | undefined): string {
  if (!value) return ""
  return value.toLocaleString("en-PH", { maximumFractionDigits: 0 })
}

export function PdaDentalChartDocument({
  patient,
  medicalHistory,
  findings = [],
  treatmentRows = [],
  dentistName,
  printedDate = new Date(),
}: {
  patient: PatientRecord | null
  medicalHistory?: MedicalHistoryRecord | null
  findings?: ToothFinding[]
  treatmentRows?: TreatmentTimelineEntry[]
  dentistName?: string | null
  printedDate?: Date
}) {
  const name = fullName(patient)
  const firstName = patient?.first_name ?? ""
  const lastName = patient?.last_name ?? ""
  const dateLabel = printedDate.toLocaleDateString("en-PH", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  })
  const age = getAge(patient?.date_of_birth)
  const gender = genderLabel(patient?.gender)
  const activeFindings = findings.filter((finding) => finding.status === "active")
  const rows = treatmentRows.slice(0, 28)

  return (
    <div id="pda-dental-chart-print" className="pda-print-root">
      {PDA_PAGE_IMAGES.map((src, index) => (
        <section className="pda-page" key={src} aria-label={`PDA Dental Chart page ${index + 1}`}>
          <Image
            src={src}
            alt=""
            fill
            sizes="8.32in"
            priority={index === 0}
            unoptimized
            className="pda-page-image"
          />

          {index === 0 ? (
            <>
              <span className="pda-field" style={{ left: "7.6%", top: "17.25%", width: "72%" }}>
                {name}
              </span>
              <span className="pda-field pda-small" style={{ left: "18.4%", top: "19.95%", width: "20%" }}>
                {lastName}
              </span>
              <span className="pda-field pda-small" style={{ left: "46.2%", top: "19.95%", width: "20%" }}>
                {firstName}
              </span>
              <span className="pda-field" style={{ left: "18.8%", top: "21.45%", width: "28%" }}>
                {formatDate(patient?.date_of_birth)}
              </span>
              <span className="pda-field" style={{ left: "50.2%", top: "21.45%", width: "8%" }}>
                {age}
              </span>
              <span className="pda-field" style={{ left: "78%", top: "21.45%", width: "15%" }}>
                {gender}
              </span>
              <span className="pda-field" style={{ left: "14.5%", top: "24.4%", width: "46%" }}>
                {patient?.address ?? ""}
              </span>
              <span className="pda-field" style={{ left: "77.6%", top: "28.4%", width: "18%" }}>
                {patient?.phone ?? ""}
              </span>
              <span className="pda-field" style={{ left: "78%", top: "31.15%", width: "18%" }}>
                {patient?.email ?? ""}
              </span>
              <span className="pda-field" style={{ left: "62.5%", top: "60.9%", width: "26%" }}>
                {medicalHistory?.medications?.join(", ") ?? ""}
              </span>
              <span className="pda-field" style={{ left: "30%", top: "62.35%", width: "32%" }}>
                {medicalHistory?.notes ?? ""}
              </span>
              {textIncludes(medicalHistory?.allergies, ["lidocaine", "local anesthetic", "anesthetic"]) ? (
                <span className="pda-check" style={{ left: "5.3%", top: "67.35%" }}>x</span>
              ) : null}
              {textIncludes(medicalHistory?.allergies, ["penicillin", "antibiotic"]) ? (
                <span className="pda-check" style={{ left: "25.3%", top: "67.35%" }}>x</span>
              ) : null}
              {textIncludes(medicalHistory?.allergies, ["sulfa"]) ? (
                <span className="pda-check" style={{ left: "5.3%", top: "68.75%" }}>x</span>
              ) : null}
              {textIncludes(medicalHistory?.allergies, ["aspirin"]) ? (
                <span className="pda-check" style={{ left: "25.3%", top: "68.75%" }}>x</span>
              ) : null}
              {textIncludes(medicalHistory?.allergies, ["latex"]) ? (
                <span className="pda-check" style={{ left: "43.3%", top: "68.75%" }}>x</span>
              ) : null}
              {medicalHistory?.allergies?.length ? (
                <span className="pda-field pda-small" style={{ left: "70.6%", top: "67.9%", width: "20%" }}>
                  {medicalHistory.allergies.join(", ")}
                </span>
              ) : null}
              {textIncludes(medicalHistory?.conditions, ["high blood", "hypertension"]) ? (
                <span className="pda-check" style={{ left: "5.4%", top: "77.5%" }}>x</span>
              ) : null}
              {textIncludes(medicalHistory?.conditions, ["low blood", "hypotension"]) ? (
                <span className="pda-check" style={{ left: "5.4%", top: "79%" }}>x</span>
              ) : null}
              {textIncludes(medicalHistory?.conditions, ["epilepsy", "convulsion"]) ? (
                <span className="pda-check" style={{ left: "5.4%", top: "80.35%" }}>x</span>
              ) : null}
              {textIncludes(medicalHistory?.conditions, ["heart"]) ? (
                <span className="pda-check" style={{ left: "37.5%", top: "77.5%" }}>x</span>
              ) : null}
              {textIncludes(medicalHistory?.conditions, ["hepatitis", "liver"]) ? (
                <span className="pda-check" style={{ left: "37.5%", top: "80.35%" }}>x</span>
              ) : null}
              {textIncludes(medicalHistory?.conditions, ["diabetes"]) ? (
                <span className="pda-check" style={{ left: "37.5%", top: "92.8%" }}>x</span>
              ) : null}
              {textIncludes(medicalHistory?.conditions, ["cancer", "tumor"]) ? (
                <span className="pda-check" style={{ left: "69.2%", top: "77.5%" }}>x</span>
              ) : null}
              {textIncludes(medicalHistory?.conditions, ["asthma"]) ? (
                <span className="pda-check" style={{ left: "69.2%", top: "83.1%" }}>x</span>
              ) : null}
            </>
          ) : null}

          {index === 2 ? (
            <>
              <span className="pda-field" style={{ left: "52.5%", top: "17.4%", width: "43%" }}>
                {name}
              </span>
              <span className="pda-field" style={{ left: "53.8%", top: "19.65%", width: "9%" }}>
                {age}
              </span>
              <span className="pda-field" style={{ left: "77.2%", top: "19.65%", width: "6%" }}>
                {gender}
              </span>
              <span className="pda-field" style={{ left: "88.4%", top: "19.65%", width: "9%" }}>
                {dateLabel}
              </span>
              {activeFindings.map((finding) => {
                const position = PERMANENT_TOOTH_POSITIONS[finding.tooth_number]
                const code = toothCode(finding)
                if (!position || !code) return null
                return (
                  <span
                    key={`${finding.tooth_number}-${code}`}
                    className="pda-tooth-code"
                    style={{ left: position.left, top: position.top }}
                  >
                    {code}
                  </span>
                )
              })}
            </>
          ) : null}

          {index === 3 ? (
            <>
              <span className="pda-field" style={{ left: "7.8%", top: "6.35%", width: "46%" }}>
                {name}
              </span>
              <span className="pda-field" style={{ left: "59.7%", top: "6.35%", width: "13%" }}>
                {age}
              </span>
              <span className="pda-field" style={{ left: "83.4%", top: "6.35%", width: "10%" }}>
                {gender}
              </span>
              {dentistName ? (
                <span className="pda-field pda-small" style={{ left: "50.8%", top: "13.6%", width: "10%" }}>
                  {dentistName}
                </span>
              ) : null}
              {rows.map((row, rowIndex) => {
                const top = 15.15 + rowIndex * 2.12
                return (
                  <div key={`${row.item_id}-${rowIndex}`} className="contents">
                    <span className="pda-field pda-small" style={{ left: "1.6%", top: `${top}%`, width: "7%" }}>
                      {formatDate(row.item_created_at)}
                    </span>
                    <span className="pda-field pda-small" style={{ left: "10.8%", top: `${top}%`, width: "7%" }}>
                      {row.tooth_number ?? ""}
                    </span>
                    <span className="pda-field pda-small" style={{ left: "19.8%", top: `${top}%`, width: "26%" }}>
                      {row.description}
                    </span>
                    <span className="pda-field pda-small" style={{ left: "48.4%", top: `${top}%`, width: "9%" }}>
                      {dentistName ?? ""}
                    </span>
                    <span className="pda-field pda-small" style={{ left: "59.8%", top: `${top}%`, width: "8%" }}>
                      {peso(row.estimated_price)}
                    </span>
                  </div>
                )
              })}
            </>
          ) : null}
        </section>
      ))}

      <style jsx>{`
        .pda-print-root {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          background: #f8fafc;
          padding: 16px;
        }

        .pda-page {
          position: relative;
          width: min(100%, 8.32in);
          aspect-ratio: 599 / 792;
          overflow: hidden;
          background: #fff;
          box-shadow: 0 8px 28px rgba(15, 23, 42, 0.12);
        }

        .pda-page-image {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: fill;
          user-select: none;
        }

        .pda-field {
          position: absolute;
          z-index: 1;
          min-height: 14px;
          overflow: hidden;
          white-space: nowrap;
          color: #111827;
          font-family: Arial, Helvetica, sans-serif;
          font-size: clamp(8px, 1.4vw, 11px);
          line-height: 1;
          text-transform: uppercase;
        }

        .pda-check {
          position: absolute;
          z-index: 1;
          color: #111827;
          font-family: Arial, Helvetica, sans-serif;
          font-size: clamp(8px, 1.45vw, 12px);
          font-weight: 700;
          line-height: 1;
        }

        .pda-tooth-code {
          position: absolute;
          z-index: 1;
          min-width: 18px;
          transform: translateX(-50%);
          color: #111827;
          font-family: Arial, Helvetica, sans-serif;
          font-size: clamp(7px, 1.15vw, 9px);
          font-weight: 700;
          line-height: 1;
          text-align: center;
        }

        .pda-small {
          font-size: clamp(7px, 1.15vw, 9px);
          text-transform: none;
        }

        @media print {
          .pda-print-root {
            display: block;
            padding: 0;
            background: #fff;
          }

          .pda-page {
            width: 8.32in;
            height: 11in;
            box-shadow: none;
            break-after: page;
            page-break-after: always;
          }

          .pda-page:last-child {
            break-after: auto;
            page-break-after: auto;
          }
        }
      `}</style>
    </div>
  )
}
