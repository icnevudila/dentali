"use client"

import * as React from "react"
import { useRouteParams } from "@/hooks/use-route-params"
import { getPatient } from "@/lib/patients/patient-service"
import { ClinicalNotesWorkspace } from "@/components/clinical/ClinicalNotesWorkspace"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { MedicalAlertBanner } from "@/components/patients/MedicalAlertBanner"

export default function ClinicalNotesPage() {
  const { id: patientId } = useRouteParams<{ id: string }>()
  const [patientName, setPatientName] = React.useState("")

  React.useEffect(() => {
    getPatient(patientId).then(({ data }) => {
      if (data) setPatientName(`${data.first_name} ${data.last_name}`)
    })
  }, [patientId])

  return (
    <PermissionGate permission={PERMISSIONS.PATIENTS_READ}>
      <div className="space-y-4">
        <MedicalAlertBanner patientId={patientId} />
        <ClinicalNotesWorkspace patientId={patientId} patientName={patientName} />
      </div>
    </PermissionGate>
  )
}
