"use client"

import { MapPin, Receipt } from "lucide-react"
import { SubNavTabs } from "@/components/layout/SubNavTabs"
import { PageHeader } from "@/components/layout/PageHeader"
import { SectionEyebrow } from "@/components/layout/SectionEyebrow"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { Badge } from "@/components/ui/badge"
import { BILLING_SUB_NAV } from "@/lib/navigation/app-nav"
import { useLocale } from "@/hooks/use-locale"
import { useBranch } from "@/hooks/use-branch"

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  const { t } = useLocale()
  const { activeBranch } = useBranch()

  return (
    <div className="mx-auto w-full max-w-7xl animate-page-enter space-y-6">
      <ContentPanel padding="lg" className="space-y-5">
        <SectionEyebrow icon={Receipt}>
          {t("billing.eyebrow", "Finance")} · {t("billing.hubTitle", "Billing & claims")}
        </SectionEyebrow>

        <PageHeader
          title={t("billing.hubTitle", "Billing & claims")}
          description={t(
            "billing.hubSubtitle",
            "Invoices, payments, HMO claims, and PhilHealth sync in one place."
          )}
        />

        {activeBranch ? (
          <div className="flex flex-wrap items-center gap-2 animate-fade-rise">
            <Badge variant="info" className="gap-1 font-normal">
              <MapPin className="h-3 w-3" aria-hidden />
              {activeBranch.name}
            </Badge>
          </div>
        ) : null}

        <SubNavTabs tabs={BILLING_SUB_NAV} />
      </ContentPanel>

      {children}
    </div>
  )
}
