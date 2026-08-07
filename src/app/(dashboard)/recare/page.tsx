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
 * Hygiene / recare worklist home.
 * Due-date query + outreach actions will land here; until then we route staff
 * to appointments / waitlist without fabricating patient rows.
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
        >
          <EmptyState
            icon={CalendarHeart}
            title={t("recare.emptyTitle", "No recall patients yet")}
            description={t(
              "recare.emptyDescription",
              "When hygiene recall is due, patients will appear here. Meanwhile, book from appointments or park them on the waitlist."
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
