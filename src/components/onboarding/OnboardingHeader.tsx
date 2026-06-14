"use client"

import { DentQLLogo } from "@/components/brand/dentql-logo"
import { useLocale } from "@/hooks/use-locale"

export function OnboardingHeader() {
  const { t } = useLocale()

  return (
    <header className="border-b border-[var(--color-border-primary)] bg-[var(--color-bg-elevated)] px-6 py-4">
      <DentQLLogo size="sm" />
      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
        {t("onboarding.wizardSubtitle", "Clinic setup wizard")}
      </p>
    </header>
  )
}
