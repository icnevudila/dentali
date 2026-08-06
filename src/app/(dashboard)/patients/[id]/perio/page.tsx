"use client"

import Link from "next/link"
import { Activity } from "lucide-react"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useLocale } from "@/hooks/use-locale"
import { useRouteParams } from "@/hooks/use-route-params"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { DirectionalTransition } from "@/components/layout/DirectionalTransition"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"

/**
 * Dedicated interactive periodontal chart route skeleton.
 * Pocket charting still lives on the dental chart for now; this page reserves
 * `/patients/[id]/perio` and links the existing print preview — no fabricated
 * probing depths or diagnoses.
 */
export default function PatientPerioChartPage() {
  const { id: patientId } = useRouteParams<{ id: string }>()
  const { t } = useLocale()

  return (
    <PermissionGate permission={PERMISSIONS.DENTAL_CHART_READ}>
      <DirectionalTransition>
        <ModulePageShell
          eyebrow={t("patients.perioEyebrow", "Clinical")}
          icon={Activity}
          title={t("patients.perioTitle", "Periodontal chart")}
          description={t(
            "patients.perioDescription",
            "Interactive probing map for this patient — reserved route until the full editor ships."
          )}
          panel={false}
          maxWidth="max-w-5xl"
        >
          <EmptyState
            icon={Activity}
            title={t("patients.perioEmptyTitle", "Interactive perio chart coming next")}
            description={t(
              "patients.perioEmptyDescription",
              "This skeleton reserves the patient perio route. Use print preview for the official probing report, or open the dental chart where pocket charting lives today — no invented clinical measurements here."
            )}
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button asChild size="sm">
                  <Link href={`/patients/${patientId}/perio/print`}>
                    {t("patients.perioOpenPrint", "Open print preview")}
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/patients/${patientId}/chart`}>
                    {t("patients.perioOpenChart", "Open dental chart")}
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/patients/${patientId}`}>
                    {t("patients.perioBackPatient", "Back to patient")}
                  </Link>
                </Button>
              </div>
            }
          />
        </ModulePageShell>
      </DirectionalTransition>
    </PermissionGate>
  )
}
