"use client"

import * as React from "react"
import { useRouteParams } from "@/hooks/use-route-params"
import { WorkflowSettingsLink } from "@/components/layout/WorkflowSettingsLink"
import { PatientPageShell } from "@/components/patients/PatientPageShell"
import { PatientEncountersWorkspace } from "@/components/patients/PatientEncountersWorkspace"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"

export default function VisitsPage() {
  const { id: patientId } = useRouteParams<{ id: string }>()
  const { activeBranch } = useBranch()
  const { t } = useLocale()

  return (
    <PatientPageShell
      patientId={patientId}
      section="Visits"
      title={t("visits.pageTitle", "Visit records")}
      description={t(
        "visits.pageDescription",
        "Every check-in is a separate visit — expand each row to control queue, notes, chart, plan, and billing."
      )}
      actions={activeBranch ? <WorkflowSettingsLink /> : null}
      maxWidth="max-w-6xl"
    >
      <div className="space-y-6">
        <PatientEncountersWorkspace patientId={patientId} branchId={activeBranch?.id} />
      </div>
    </PatientPageShell>
  )
}
