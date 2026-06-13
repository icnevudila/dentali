"use client"

import { useLocale } from "@/hooks/use-locale"

export function OnboardingHeader() {
  const { t } = useLocale()

  return (
    <header className="border-b border-[var(--color-border-primary)] bg-[var(--color-bg-elevated)] px-6 py-4">
      <p className="text-sm font-semibold text-primary-600">
        dentali.
      </p>
      <p className="text-xs text-[var(--color-text-secondary)]">
        {t("onboarding.wizardSubtitle", "Clinic setup wizard")}
      </p>
    </header>
  )
}
