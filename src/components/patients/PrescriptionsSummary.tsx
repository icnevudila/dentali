"use client"

import * as React from "react"
import Link from "next/link"
import { Pill, Printer, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { fetchPatientPrescriptions, getPrescription, type PrescriptionRecord } from "@/lib/clinical/prescription-service"
import { buildPrescriptionPrintHtml, printPrescription } from "@/lib/clinical/prescription-print"
import { fetchOrganization, fetchStaffProfile } from "@/lib/auth/auth-service"
import { getPatient } from "@/lib/patients/patient-service"
import { getLatestMedicalHistory } from "@/lib/patients/medical-history-service"
import { fetchOrganizationPreferences } from "@/lib/settings/org-preferences-service"
import { useBranch } from "@/hooks/use-branch"
import { NAV_FORWARD_TRANSITION } from "@/lib/navigation/view-transition"

interface PrescriptionsSummaryProps {
  patientId: string
}

function formatPatientGender(gender: string | null | undefined): string | null {
  if (!gender || gender === "prefer_not_to_say") return null
  if (gender === "male") return "Male"
  if (gender === "female") return "Female"
  return gender
}

export function PrescriptionsSummary({ patientId }: PrescriptionsSummaryProps) {
  const { activeBranch } = useBranch()
  const [history, setHistory] = React.useState<PrescriptionRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [patientName, setPatientName] = React.useState("")
  const [patientDob, setPatientDob] = React.useState<string | null>(null)
  const [patientSex, setPatientSex] = React.useState<string | null>(null)
  const [medicalHistory, setMedicalHistory] = React.useState<Awaited<ReturnType<typeof getLatestMedicalHistory>>["data"]>(null)

  React.useEffect(() => {
    getPatient(patientId).then(({ data }) => {
      if (data) {
        setPatientName(`${data.first_name} ${data.last_name}`)
        setPatientDob(data.date_of_birth)
        setPatientSex(formatPatientGender(data.gender))
      }
    })
    getLatestMedicalHistory(patientId).then(({ data }) => setMedicalHistory(data))
  }, [patientId])

  React.useEffect(() => {
    if (!activeBranch?.id) return
    fetchPatientPrescriptions(patientId, activeBranch.id).then(({ data }) => {
      setHistory(data)
      setLoading(false)
    })
  }, [patientId, activeBranch?.id])

  const handlePrint = async (rx: PrescriptionRecord) => {
    const full = rx.items ? rx : (await getPrescription(rx.id)).data
    if (!full?.items?.length) return
    const [org, staff, prefs] = await Promise.all([
      fetchOrganization(),
      fetchStaffProfile(),
      fetchOrganizationPreferences(),
    ])
    const age = patientDob
      ? String(new Date().getFullYear() - new Date(patientDob).getFullYear())
      : null
    const html = buildPrescriptionPrintHtml({
      prescription: full,
      items: full.items,
      patientName,
      patientAge: age,
      patientSex,
      clinicName: org?.name ?? "Dental Clinic",
      clinicAddress: org?.address,
      clinicPhone: org?.contact_number,
      branchName: activeBranch?.name,
      prescriberLicenseNumber: staff?.prc_license_number,
      allergies: medicalHistory?.allergies ?? [],
      medications: medicalHistory?.medications ?? [],
      branding: prefs.data?.prescription_branding,
    })
    printPrescription(html)
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-neutral-100" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          {history.length === 0
            ? "No prescriptions yet."
            : `${history.length} prescription${history.length !== 1 ? "s" : ""} on record.`}
        </p>
        <PermissionGate permission={PERMISSIONS.PRESCRIPTIONS_WRITE}>
          <Button size="sm" className="gap-1" asChild>
            <Link href={`/patients/${patientId}/prescriptions`} transitionTypes={NAV_FORWARD_TRANSITION}>
              <Plus className="h-3.5 w-3.5" /> New Prescription
            </Link>
          </Button>
        </PermissionGate>
      </div>

      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 py-10 text-center">
          <Pill className="mb-2 h-8 w-8 text-neutral-300" />
          <p className="text-sm font-medium text-neutral-500">No prescriptions</p>
          <p className="mt-1 text-xs text-neutral-400">
            Prescriptions written for this patient will appear here.
          </p>
          <PermissionGate permission={PERMISSIONS.PRESCRIPTIONS_WRITE}>
            <Button size="sm" variant="outline" className="mt-3 gap-1" asChild>
              <Link href={`/patients/${patientId}/prescriptions`} transitionTypes={NAV_FORWARD_TRANSITION}>
                <Plus className="h-3.5 w-3.5" /> Write first prescription
              </Link>
            </Button>
          </PermissionGate>
        </div>
      ) : (
        <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
          {history.slice(0, 5).map((rx) => (
            <li key={rx.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-neutral-900">
                  {rx.diagnosis ?? "Prescription"}
                  <Badge
                    variant={rx.status === "signed" ? "success" : rx.status === "voided" ? "danger" : "outline"}
                    className="ml-2 text-[10px]"
                  >
                    {rx.status}
                  </Badge>
                </p>
                <p className="text-xs text-neutral-500">
                  {new Date(rx.signed_at ?? rx.created_at).toLocaleString("en-PH", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                  {rx.prescriber_name ? ` · ${rx.prescriber_name}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                {rx.status === "signed" && (
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => void handlePrint(rx)}>
                    <Printer className="h-3.5 w-3.5" /> Print
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {history.length > 5 && (
        <div className="text-center">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/patients/${patientId}/prescriptions`} transitionTypes={NAV_FORWARD_TRANSITION}>
              View all {history.length} prescriptions →
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}
