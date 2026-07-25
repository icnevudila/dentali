"use client"

import * as React from "react"
import { usePathname, useParams } from "next/navigation"
import { PatientVisitActionRail } from "@/components/patients/PatientVisitActionRail"

/**
 * Clean, lightweight layout for patient sub-routes.
 * Renders the clean action rail when needed without heavy stacked banner clutter.
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
  const showActionRail = Boolean(patientId) && !isProfileRoot && !isPrint

  return (
    <div className="min-w-0">
      {showActionRail ? <PatientVisitActionRail patientId={patientId} /> : null}
      {children}
    </div>
  )
}
