"use client"

import * as React from "react"
import { useRouteParams } from "@/hooks/use-route-params"
import { getPatient } from "@/lib/patients/patient-service"
import { PatientPageShell } from "@/components/patients/PatientPageShell"
import { PatientVisitHistoryPanel } from "@/components/patients/PatientVisitHistoryPanel"
import { useBranch } from "@/hooks/use-branch"

export default function VisitsPage() {
  const { id: patientId } = useRouteParams<{ id: string }>()
  const { activeBranch } = useBranch()
  const [patientName, setPatientName] = React.useState("")

  React.useEffect(() => {
    getPatient(patientId).then(({ data }) => {
      if (data) setPatientName(`${data.first_name} ${data.last_name}`)
    })
  }, [patientId])

  return (
    <PatientPageShell
      patientId={patientId}
      section="Visits"
      title="Visit Records"
      description={`Clinical visit history and check-ins for ${patientName}`}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-6">
        <PatientVisitHistoryPanel patientId={patientId} branchId={activeBranch?.id} />
      </div>
    </PatientPageShell>
  )
}
