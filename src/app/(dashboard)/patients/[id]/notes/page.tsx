"use client"

import * as React from "react"
import { useRouteParams } from "@/hooks/use-route-params"
import { getPatient } from "@/lib/patients/patient-service"
import { ClinicalNotesWorkspace } from "@/components/clinical/ClinicalNotesWorkspace"

export default function ClinicalNotesPage() {
  const { id: patientId } = useRouteParams<{ id: string }>()
  const [patientName, setPatientName] = React.useState("")

  React.useEffect(() => {
    getPatient(patientId).then(({ data }) => {
      if (data) setPatientName(`${data.first_name} ${data.last_name}`)
    })
  }, [patientId])

  return <ClinicalNotesWorkspace patientId={patientId} patientName={patientName} />
}
