"use client"

import * as React from "react"
import { useRouteParams } from "@/hooks/use-route-params"
import { useBranch } from "@/hooks/use-branch"
import { useAuth } from "@/hooks/use-auth"
import { useLocale } from "@/hooks/use-locale"
import { getPatient } from "@/lib/patients/patient-service"
import { getLatestMedicalHistory } from "@/lib/patients/medical-history-service"
import { fetchPatientTimeline } from "@/lib/clinical/clinical-notes-service"
import { fetchPatientTreatmentTimeline } from "@/lib/clinical/treatment-plan-service"
import { fetchOrganization, fetchStaffProfile } from "@/lib/auth/auth-service"
import {
  buildDefaultAbstractSummary,
  buildMedicalAbstractPrintHtml,
  printClinicalLetter,
  type MedicalAbstractData,
} from "@/lib/clinical/clinical-letter-print"
import { PatientPageShell } from "@/components/patients/PatientPageShell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { FileText, Printer } from "lucide-react"

export default function MedicalAbstractPage() {
  const { id: patientId } = useRouteParams<{ id: string }>()
  const { activeBranch } = useBranch()
  const { user } = useAuth()
  const { t } = useLocale()

  const [base, setBase] = React.useState<Omit<
    MedicalAbstractData,
    "purpose" | "clinicalSummary" | "treatmentSummary" | "additionalNotes" | "attendingDentist" | "licenseNumber"
  > | null>(null)
  const [purpose, setPurpose] = React.useState("Referral / insurance documentation")
  const [clinicalSummary, setClinicalSummary] = React.useState("")
  const [treatmentSummary, setTreatmentSummary] = React.useState("")
  const [additionalNotes, setAdditionalNotes] = React.useState("")
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
      const [patientRes, medicalRes, timelineRes, org, staff] = await Promise.all([
        getPatient(patientId),
        getLatestMedicalHistory(patientId),
        fetchPatientTimeline(patientId),
        fetchOrganization(),
        fetchStaffProfile(),
      ])
      const treatmentRes = await fetchPatientTreatmentTimeline(patientId, activeBranch?.id)

      if (cancelled) return
      if (!patientRes.data) {
        setError(patientRes.error ?? "Patient not found")
        setLoading(false)
        return
      }

      const defaults = buildDefaultAbstractSummary(medicalRes.data, treatmentRes.data ?? [])
      setClinicalSummary(defaults.clinicalSummary)
      setTreatmentSummary(defaults.treatmentSummary)
      if (staff?.full_name) setAttendingDentist(staff.full_name)
      if (staff?.prc_license_number) setLicenseNumber(staff.prc_license_number)

      setBase({
        patient: patientRes.data,
        medicalHistory: medicalRes.data,
        timeline: timelineRes.data ?? [],
        treatmentItems: treatmentRes.data ?? [],
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
  }, [patientId, activeBranch?.id, activeBranch?.name, user?.email])

  const handlePrint = () => {
    if (!base) return
    printClinicalLetter(
      buildMedicalAbstractPrintHtml({
        ...base,
        purpose,
        clinicalSummary,
        treatmentSummary,
        additionalNotes,
        attendingDentist,
        licenseNumber,
      })
    )
  }

  const patientName = base ? `${base.patient.first_name} ${base.patient.last_name}` : "Patient"

  return (
    <PatientPageShell
      patientId={patientId}
      section={t("patients.medicalAbstract", "Medical Abstract")}
      title={t("patients.medicalAbstractTitle", "Medical Abstract")}
      description={t(
        "patients.medicalAbstractDesc",
        "Clinical summary letter for referral, insurance, or handover — {name}"
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
              <FileText className="h-5 w-5 text-teal-600" />
              {t("patients.medicalAbstractForm", "Abstract content")}
            </CardTitle>
            <CardDescription>
              {t(
                "patients.medicalAbstractFormHint",
                "Review auto-filled summaries from the chart, edit as needed, then print."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium">{t("patients.abstractPurpose", "Purpose")}</label>
              <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t("patients.clinicalSummary", "Clinical summary")}</label>
              <textarea
                value={clinicalSummary}
                onChange={(e) => setClinicalSummary(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t("patients.treatmentSummary", "Treatment summary")}</label>
              <textarea
                value={treatmentSummary}
                onChange={(e) => setTreatmentSummary(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t("patients.additionalNotes", "Additional remarks")}</label>
              <textarea
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                placeholder={t("patients.abstractNotesPlaceholder", "Optional notes for receiving physician…")}
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
              {t("patients.generateAbstract", "Generate medical abstract")}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </PatientPageShell>
  )
}
