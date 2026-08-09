"use client"

import * as React from "react"
import Link from "next/link"
import { Activity, Printer, LayoutGrid } from "lucide-react"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { usePermission } from "@/hooks/use-permission"
import { useAuth } from "@/hooks/use-auth"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { useRouteParams } from "@/hooks/use-route-params"
import { fetchOrganization } from "@/lib/auth/auth-service"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { PeriodontalPocketPanel } from "@/components/odontogram/PeriodontalPocketPanel"
import { PeriodontalScreeningPanel } from "@/components/odontogram/PeriodontalScreeningPanel"
import { PeriodontalAuditHistoryPanel } from "@/components/odontogram/PeriodontalAuditHistoryPanel"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"

/**
 * Interactive periodontal chart MVP for `/patients/[id]/perio`.
 * Reads/writes via dental_chart permissions + periodontal RPCs.
 * Print preview only reflects saved probing depths — no fabricated clinical data.
 */
export default function PatientPerioChartPage() {
  const { id: patientId } = useRouteParams<{ id: string }>()
  const { t } = useLocale()
  const { user } = useAuth()
  const { activeBranch } = useBranch()
  const { hasPermission } = usePermission()
  const canWrite = hasPermission(PERMISSIONS.DENTAL_CHART_WRITE)

  const [orgId, setOrgId] = React.useState<string | null>(null)
  const [orgLoading, setOrgLoading] = React.useState(true)
  const [orgError, setOrgError] = React.useState<string | null>(null)
  const [orgRetry, setOrgRetry] = React.useState(0)
  const [chartRefreshKey, setChartRefreshKey] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    setOrgLoading(true)
    setOrgError(null)
    void fetchOrganization()
      .then((org) => {
        if (cancelled) return
        setOrgId(org?.id ?? null)
        if (!org?.id) {
          setOrgError(
            t(
              "patients.perioOrgMissing",
              "Clinic organization could not be loaded. Retry or sign in again."
            )
          )
        }
      })
      .catch(() => {
        if (cancelled) return
        setOrgError(
          t(
            "patients.perioOrgMissing",
            "Clinic organization could not be loaded. Retry or sign in again."
          )
        )
      })
      .finally(() => {
        if (!cancelled) setOrgLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [orgRetry, t])

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild size="sm" variant="outline">
        <Link href={`/patients/${patientId}/perio/print`}>
          <Printer className="mr-1.5 h-3.5 w-3.5" />
          {t("patients.perioOpenPrint", "Open print preview")}
        </Link>
      </Button>
      <Button asChild size="sm" variant="outline">
        <Link href={`/patients/${patientId}/chart`}>
          <LayoutGrid className="mr-1.5 h-3.5 w-3.5" />
          {t("patients.perioOpenChart", "Open dental chart")}
        </Link>
      </Button>
      <Button asChild size="sm" variant="ghost">
        <Link href={`/patients/${patientId}`}>
          {t("patients.perioBackPatient", "Back to patient")}
        </Link>
      </Button>
    </div>
  )

  return (
    <PermissionGate permission={PERMISSIONS.DENTAL_CHART_READ}>
      <ModulePageShell
        eyebrow={t("patients.perioEyebrow", "Clinical")}
        icon={Activity}
        title={t("patients.perioTitle", "Periodontal chart")}
        description={t(
          "patients.perioDescription",
          "Six-site pocket depths and BOP for this patient. Saves to the active dental chart — print only when measurements exist."
        )}
        actions={actions}
        panel={false}
        maxWidth="max-w-5xl"
        error={orgError}
        onRetry={() => setOrgRetry((n) => n + 1)}
        retryLabel={t("common.retry", "Retry")}
      >
        {!activeBranch ? (
          <EmptyState
            icon={Activity}
            title={t("patients.perioSelectBranchTitle", "Select a branch")}
            description={t(
              "patients.perioSelectBranchDescription",
              "Choose an active clinic branch to load or save periodontal measurements."
            )}
          />
        ) : orgLoading ? (
          <PageLoadingSkeleton variant="detail" className="px-0 py-2" />
        ) : orgError ? null : (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              {canWrite
                ? t(
                    "patients.perioWriteHint",
                    "Enter pocket depths in mm (0–15). Changes auto-save with chart audit history. Asia/Manila clinic time applies to print dates."
                  )
                : t(
                    "patients.perioReadOnlyHint",
                    "Read-only view. Ask a clinician with dental chart write access to record probing depths."
                  )}
            </p>
            <PeriodontalPocketPanel
              key={chartRefreshKey}
              patientId={patientId}
              branchId={activeBranch.id}
              organizationId={orgId}
              actorUserId={user?.id ?? null}
              canWrite={canWrite}
              className="shadow-sm"
            />
            <PeriodontalAuditHistoryPanel
              patientId={patientId}
              branchId={activeBranch.id}
              organizationId={orgId}
              actorUserId={user?.id ?? null}
              canWrite={canWrite}
              onRestored={() => setChartRefreshKey((n) => n + 1)}
            />
            <PeriodontalScreeningPanel patientId={patientId} />
            <p className="text-xs text-neutral-500">
              {t(
                "patients.perioPrintHonesty",
                "Print preview shows only saved probing depths — it will stay empty until at least one site is recorded."
              )}
            </p>
          </div>
        )}
      </ModulePageShell>
    </PermissionGate>
  )
}
