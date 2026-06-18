"use client"

import * as React from "react"
import { useRouteParams } from "@/hooks/use-route-params"
import { useBranch } from "@/hooks/use-branch"
import { useAuth } from "@/hooks/use-auth"
import { useLocale } from "@/hooks/use-locale"
import { getPatient } from "@/lib/patients/patient-service"
import { fetchOrganization, fetchStaffProfile } from "@/lib/auth/auth-service"
import {
  buildMedicalCertificatePrintHtml,
  printClinicalLetter,
  type MedicalCertificateData,
  type MedicalCertificateType,
} from "@/lib/clinical/clinical-letter-print"
import { PatientPageShell } from "@/components/patients/PatientPageShell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { Printer, ScrollText } from "lucide-react"

const todayIso = () => new Date().toISOString().slice(0, 10)

export default function MedicalCertificatePage() {
  const { id: patientId } = useRouteParams<{ id: string }>()
  const { activeBranch } = useBranch()
  const { user } = useAuth()
  const { t } = useLocale()

  const [base, setBase] = React.useState<Omit<
    MedicalCertificateData,
    | "certificateType"
    | "purpose"
    | "diagnosis"
    | "recommendation"
    | "restDays"
    | "examinationDate"
    | "validFrom"
    | "validUntil"
    | "remarks"
    | "attendingDentist"
    | "licenseNumber"
  > | null>(null)
  const [certificateType, setCertificateType] = React.useState<MedicalCertificateType>("fit_to_work")
  const [purpose, setPurpose] = React.useState("Employment / school requirement")
  const [diagnosis, setDiagnosis] = React.useState(
    "Dental examination completed. Oral health status assessed; no acute infection requiring emergency care."
  )
  const [recommendation, setRecommendation] = React.useState(
    "Patient is fit to resume normal activities as tolerated."
  )
  const [restDays, setRestDays] = React.useState("")
  const [examinationDate, setExaminationDate] = React.useState(todayIso())
  const [validFrom, setValidFrom] = React.useState("")
  const [validUntil, setValidUntil] = React.useState("")
  const [remarks, setRemarks] = React.useState("")
  const [attendingDentist, setAttendingDentist] = React.useState("")
  const [licenseNumber, setLicenseNumber] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!patientId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      const [patientRes, org, staff] = await Promise.all([
        getPatient(patientId),
        fetchOrganization(),
        fetchStaffProfile(),
      ])

      if (cancelled) return
      if (!patientRes.data) {
        setError(patientRes.error ?? "Patient not found")
        setLoading(false)
        return
      }

      if (staff?.full_name) setAttendingDentist(staff.full_name)
      if (staff?.prc_license_number) setLicenseNumber(staff.prc_license_number)

      setBase({
        patient: patientRes.data,
        clinicName: org?.name ?? "Dental Clinic",
        clinicAddress: org?.address,
        clinicPhone: org?.contact_number,
        branchName: activeBranch?.name,
        generatedBy: user?.email ?? null,
      })
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [patientId, activeBranch?.name, user?.email])

  React.useEffect(() => {
    if (certificateType === "rest" || certificateType === "school") {
      setRecommendation("Patient is advised to limit strenuous activity and follow post-treatment care instructions.")
    } else if (certificateType === "fit_to_work") {
      setRecommendation("Patient is fit to work / attend school without dental-related restriction.")
    } else if (certificateType === "procedure") {
      setRecommendation("Patient underwent dental procedure today and may require short recovery as noted.")
    }
  }, [certificateType])

  const handlePrint = () => {
    if (!base) return
    const restNum = restDays.trim() ? Number.parseInt(restDays, 10) : null
    printClinicalLetter(
      buildMedicalCertificatePrintHtml({
        ...base,
        certificateType,
        purpose,
        diagnosis,
        recommendation,
        restDays: restNum && !Number.isNaN(restNum) ? restNum : null,
        examinationDate,
        validFrom,
        validUntil,
        remarks,
        attendingDentist,
        licenseNumber,
      })
    )
  }

  const patientName = base ? `${base.patient.first_name} ${base.patient.last_name}` : "Patient"

  return (
    <PatientPageShell
      patientId={patientId}
      section={t("patients.medicalCertificate", "Medical Certificate")}
      title={t("patients.medicalCertificateTitle", "Medical Certificate")}
      description={t(
        "patients.medicalCertificateDesc",
        "Fit-to-work, rest, or procedure certificate for {name}"
      ).replace("{name}", patientName)}
      maxWidth="max-w-3xl"
      error={error}
      actions={
        base ? (
          <Button className="gap-1.5" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            {t("common.printPdf", "Print / PDF")}
          </Button>
        ) : null
      }
    >
      {loading ? (
        <PageLoadingSkeleton variant="detail" />
      ) : base ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ScrollText className="h-5 w-5 text-teal-600" />
              {t("patients.certificateForm", "Certificate details")}
            </CardTitle>
            <CardDescription>
              {t(
                "patients.certificateFormHint",
                "Standard TO WHOM IT MAY CONCERN format — edit findings and print."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium">{t("patients.certificateType", "Certificate type")}</label>
                <select
                  value={certificateType}
                  onChange={(e) => setCertificateType(e.target.value as MedicalCertificateType)}
                  className="h-10 w-full rounded-md border border-neutral-300 px-3 text-sm"
                >
                  <option value="fit_to_work">Fit to work / travel</option>
                  <option value="rest">Medical rest / excuse</option>
                  <option value="school">School / work excuse</option>
                  <option value="procedure">Post-procedure</option>
                  <option value="custom">General</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">{t("patients.examinationDate", "Examination date")}</label>
                <Input type="date" value={examinationDate} onChange={(e) => setExaminationDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t("patients.certificatePurpose", "Purpose / request")}</label>
              <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t("patients.diagnosis", "Findings / diagnosis")}</label>
              <textarea
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t("patients.recommendation", "Recommendation")}</label>
              <textarea
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">{t("patients.restDays", "Rest days (optional)")}</label>
                <Input
                  type="number"
                  min={0}
                  value={restDays}
                  onChange={(e) => setRestDays(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">{t("patients.validFrom", "Valid from")}</label>
                <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">{t("patients.validUntil", "Valid until")}</label>
                <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t("patients.remarks", "Remarks")}</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium">{t("patients.attendingDentist", "Attending dentist")}</label>
                <Input value={attendingDentist} onChange={(e) => setAttendingDentist(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">{t("patients.licenseNumber", "PRC license no.")}</label>
                <Input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
              </div>
            </div>
            <Button className="gap-1.5 w-full sm:w-auto" onClick={handlePrint}>
              <Printer className="h-4 w-4" />
              {t("patients.generateCertificate", "Generate medical certificate")}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </PatientPageShell>
  )
}
