"use client"

import Link from "next/link"
import { CalendarHeart, Settings2 } from "lucide-react"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useLocale } from "@/hooks/use-locale"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { DirectionalTransition } from "@/components/layout/DirectionalTransition"

/**
 * Hygiene / recare worklist skeleton.
 * CareStack / Dentrix Ascend / Dentally expose a first-class recall list;
 * we currently only have a workflow SMS toggle — this page is the nav home
 * until due-date query + outreach actions ship.
 */
export default function RecarePage() {
  const { t } = useLocale()

  return (
    <PermissionGate permission={PERMISSIONS.APPOINTMENTS_READ}>
      <DirectionalTransition>
        <ModulePageShell
          eyebrow={t("recare.eyebrow", "Front desk")}
          icon={CalendarHeart}
          title={t("nav.recare", "Recare")}
          description={t(
            "recare.description",
            "Patients due for hygiene or recall visits. Book, message, or snooze from one worklist."
          )}
          actions={
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href="/settings/workflow">
                <Settings2 className="h-4 w-4" aria-hidden />
                {t("recare.openWorkflow", "Hygiene recall settings")}
              </Link>
            </Button>
          }
          panel={false}
        >
          <EmptyState
            icon={CalendarHeart}
            title={t("recare.emptyTitle", "Recare worklist coming next")}
            description={t(
              "recare.emptyDescription",
              "This skeleton reserves the route and nav for a Dentrix Ascend–style recall queue. Due patients, last visit, and outreach actions will land here — no fake PHI in the meantime."
            )}
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button asChild size="sm">
                  <Link href="/appointments">{t("recare.openAppointments", "Open appointments")}</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/waitlist">{t("recare.openWaitlist", "Open waitlist")}</Link>
                </Button>
              </div>
            }
          />
        </ModulePageShell>
      </DirectionalTransition>
    </PermissionGate>
  )
}
