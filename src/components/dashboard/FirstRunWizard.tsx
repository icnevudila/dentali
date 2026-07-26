"use client"

import * as React from "react"
import Link from "next/link"
import { Building2, Check, ChevronRight, UserPlus, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { usePageDismiss } from "@/hooks/use-page-dismiss"
import { NAV_FORWARD_TRANSITION } from "@/lib/navigation/view-transition"
import { cn } from "@/lib/utils"

type FirstRunWizardProps = {
  /** Hide when clinic already has patients (first-run complete). */
  patientCount: number
  loading?: boolean
}

const STEPS = [
  { id: 1, icon: Building2 },
  { id: 2, icon: Users },
  { id: 3, icon: UserPlus },
] as const

/**
 * ≤3-step first-run after onboarding: confirm clinic → optional staff → first patient.
 * Hidden when dismissed or when the branch already has patients.
 */
export function FirstRunWizard({ patientCount, loading }: FirstRunWizardProps) {
  const { activeBranch } = useBranch()
  const { t } = useLocale()
  const dismissKey = activeBranch ? `first-run:${activeBranch.id}` : undefined
  const { dismissed, dismiss } = usePageDismiss(dismissKey)
  const [step, setStep] = React.useState(1)

  if (!activeBranch || loading || dismissed || patientCount > 0) {
    return null
  }

  return (
    <section
      className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-bg-secondary)] p-4 sm:p-5 animate-fade-rise"
      aria-labelledby="first-run-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            {t("dashboard.firstRunEyebrow", "Get started")}
          </p>
          <h2 id="first-run-title" className="text-base font-semibold text-[var(--color-text-primary)]">
            {t("dashboard.firstRunTitle", "Three steps to your first patient")}
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t(
              "dashboard.firstRunSubtitle",
              "Visit automations are already on. Confirm your clinic, invite help if you want, then add a patient."
            )}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={dismiss} className="shrink-0 text-neutral-500">
          {t("dashboard.firstRunSkip", "Skip for now")}
        </Button>
      </div>

      <ol className="mt-4 flex gap-2" aria-label={t("dashboard.firstRunSteps", "Setup steps")}>
        {STEPS.map((s) => {
          const Icon = s.icon
          const done = step > s.id
          const current = step === s.id
          return (
            <li
              key={s.id}
              className={cn(
                "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-medium",
                current
                  ? "bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm ring-1 ring-[var(--color-border-secondary)]"
                  : done
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-transparent text-[var(--color-text-secondary)]"
              )}
              aria-current={current ? "step" : undefined}
            >
              {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Icon className="h-3.5 w-3.5" aria-hidden />}
              <span className="hidden sm:inline">{s.id}</span>
            </li>
          )
        })}
      </ol>

      <div className="mt-4 rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-bg-primary)] p-4">
        {step === 1 ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {t("dashboard.firstRunStep1Title", "Confirm this clinic")}
            </p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {t(
                "dashboard.firstRunStep1Body",
                "You're working in {branch}. Hours and visit flow are ready — you can tweak them later under Settings."
              ).replace("{branch}", activeBranch.name)}
            </p>
            <Button type="button" className="gap-1" onClick={() => setStep(2)}>
              {t("dashboard.firstRunContinue", "Continue")}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {t("dashboard.firstRunStep2Title", "Invite a teammate (optional)")}
            </p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {t(
                "dashboard.firstRunStep2Body",
                "Add a receptionist or dentist now, or skip and do it alone for the first visit."
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="gap-2">
                <Link href="/settings/staff/invite" transitionTypes={NAV_FORWARD_TRANSITION}>
                  <Users className="h-4 w-4" />
                  {t("dashboard.firstRunInviteStaff", "Invite staff")}
                </Link>
              </Button>
              <Button type="button" className="gap-1" onClick={() => setStep(3)}>
                {t("dashboard.firstRunSkipStaff", "Skip — just me")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {t("dashboard.firstRunStep3Title", "Add your first patient")}
            </p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {t(
                "dashboard.firstRunStep3Body",
                "Register one patient, then book an appointment from the Patients or Appointments page."
              )}
            </p>
            <Button asChild className="gap-2">
              <Link href="/patients/new" transitionTypes={NAV_FORWARD_TRANSITION}>
                <UserPlus className="h-4 w-4" />
                {t("dashboard.firstRunAddPatient", "Add patient")}
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
