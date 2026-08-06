"use client"

import Link from "next/link"
import { Wallet } from "lucide-react"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useLocale } from "@/hooks/use-locale"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { DirectionalTransition } from "@/components/layout/DirectionalTransition"

/**
 * AR chase / collections worklist skeleton.
 * CareStack-style gap: open balances, aging buckets, and outreach live here
 * once the query ships — no fake AR rows or PHI in the meantime.
 */
export default function BillingCollectionsPage() {
  const { t } = useLocale()

  return (
    <PermissionGate permission={PERMISSIONS.BILLING_READ}>
      <DirectionalTransition>
        <ModulePageShell
          eyebrow={t("billing.collectionsEyebrow", "Finance")}
          icon={Wallet}
          title={t("billing.collectionsTitle", "Collections")}
          description={t(
            "billing.collectionsDescription",
            "Accounts-receivable chase worklist — aging, reminders, and settlement follow-ups in one place."
          )}
          panel={false}
        >
          <EmptyState
            icon={Wallet}
            title={t("billing.collectionsEmptyTitle", "AR worklist coming next")}
            description={t(
              "billing.collectionsEmptyDescription",
              "This skeleton reserves the route and billing nav for a CareStack-style collections queue. Open balances and aging actions will land here — no invented AR rows or patient data until then."
            )}
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button asChild size="sm">
                  <Link href="/reports?focus=billing#finance">
                    {t("billing.collectionsOpenReports", "Open finance reports")}
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/billing">{t("billing.collectionsOpenInvoices", "Open invoices")}</Link>
                </Button>
              </div>
            }
          />
        </ModulePageShell>
      </DirectionalTransition>
    </PermissionGate>
  )
}
