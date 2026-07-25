"use client"

import * as React from "react"
import { usePathname, useParams } from "next/navigation"
import { ClinicalWorkflowPipelineNavbar } from "@/components/patients/ClinicalWorkflowPipelineNavbar"
import { PatientQuickDock } from "@/components/patients/PatientQuickDock"
import { PatientVisitActionRail } from "@/components/patients/PatientVisitActionRail"

/**
 * Clinical Workflow Pipeline Navbar, Quick Dock & Action Rail for every patient sub-route.
 * Hidden on the profile root and print surfaces.
 */
export default function PatientSectionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const params = useParams()
  const patientId = String(params.id ?? "")

  const isProfileRoot =
    Boolean(patientId) &&
    (pathname === `/patients/${patientId}` || pathname === `/patients/${patientId}/`)
  const isPrint = pathname.includes("/print")
  const showBar = Boolean(patientId) && !isProfileRoot && !isPrint

  return (
    <div className="min-w-0">
      {showBar ? (
        <>
          <ClinicalWorkflowPipelineNavbar patientId={patientId} />
          <PatientQuickDock patientId={patientId} />
          <PatientVisitActionRail patientId={patientId} />
        </>
      ) : null}
      {children}
    </div>
  )
}
