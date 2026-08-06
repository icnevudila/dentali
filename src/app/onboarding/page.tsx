"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Building2, MapPin, CheckCircle2, ChevronRight, ChevronLeft } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { completeOnboarding, acceptStaffInvitation, fetchMyBranches, logSessionEvent } from "@/lib/auth/auth-service"
import { useBranch } from "@/hooks/use-branch"
import { useAuth } from "@/hooks/use-auth"
import { useLocale } from "@/hooks/use-locale"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"

const STEPS = [
  { id: 1, key: "stepClinic" as const, icon: Building2, fallback: "Clinic" },
  { id: 2, key: "stepBranch" as const, icon: MapPin, fallback: "Branch" },
  { id: 3, key: "stepFinish" as const, icon: CheckCircle2, fallback: "Finish" },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { setActiveBranch, setAvailableBranches } = useBranch()
  const { t } = useLocale()

  const [step, setStep] = React.useState(1)
  const [orgName, setOrgName] = React.useState("")
  const [ownerName, setOwnerName] = React.useState("")
  const [branchName, setBranchName] = React.useState("Main Clinic")
  const [branchAddress, setBranchAddress] = React.useState("")
  const [branchPhone, setBranchPhone] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [checking, setChecking] = React.useState(true)

  React.useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace("/login")
      return
    }
    const meta = user.user_metadata ?? {}
    setOwnerName(
      (typeof meta.full_name === "string" && meta.full_name) ||
        user.email?.split("@")[0] ||
        ""
    )
    const clinicFromSignup = typeof meta.clinic_name === "string" ? meta.clinic_name.trim() : ""
    setOrgName(clinicFromSignup || `${user.email?.split("@")[0] ?? "My"} Dental Clinic`)

    fetchMyBranches().then(async (branches) => {
      if (branches.length > 0) {
        router.replace("/")
        return
      }
      const invite = await acceptStaffInvitation()
      if (invite.status === "accepted") {
        await logSessionEvent("login")
        router.replace("/")
        return
      }
      setChecking(false)
    })
  }, [user, authLoading, router])

  const handleFinish = async () => {
    if (!orgName.trim() || !branchName.trim()) {
      setError(t("onboarding.bothRequired", "Organization and branch name are required."))
      return
    }
    setSubmitting(true)
    setError(null)

    const { error: setupError, branchId } = await completeOnboarding({
      orgName: orgName.trim(),
      branchName: branchName.trim(),
      branchAddress: branchAddress.trim() || undefined,
      branchPhone: branchPhone.trim() || undefined,
      ownerName: ownerName.trim() || undefined,
    })

    if (setupError) {
      setError(
        setupError.length > 120
          ? t("onboarding.setupFailed", "Could not finish clinic setup. Check your connection and try again.")
          : setupError
      )
      setSubmitting(false)
      return
    }

    const branches = await fetchMyBranches()
    setAvailableBranches(
      branches.map((b) => ({
        id: b.id,
        name: b.name,
        organization_id: b.organization_id,
      }))
    )
    const active = branches.find((b) => b.id === branchId) ?? branches[0]
    if (active) {
      setActiveBranch({
        id: active.id,
        name: active.name,
        organization_id: active.organization_id,
      })
    }

    await logSessionEvent("login")
    router.replace("/")
    router.refresh()
  }

  if (authLoading || checking) {
    return <PageLoadingSkeleton variant="form" className="max-w-lg mx-auto w-full" />
  }

  const stepTitle =
    step === 1
      ? t("onboarding.stepOrgTitle", "Organization")
      : step === 2
        ? t("onboarding.stepBranchTitle", "First branch")
        : t("onboarding.stepReviewTitle", "Review & launch")

  const stepDesc =
    step === 1
      ? t(
          "onboarding.stepOrgDesc",
          "Your clinic group or practice name — shown on invoices and staff invites."
        )
      : step === 2
        ? t(
            "onboarding.stepBranchDesc",
            "The location where patients check in and are seen day to day."
          )
        : t("onboarding.stepReviewDesc", "Confirm details before entering the dashboard.")

  const stepOfLabel = t("onboarding.stepOf", "Step {current} of {total}")
    .replace("{current}", String(step))
    .replace("{total}", String(STEPS.length))

  return (
    <div className="w-full max-w-lg space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          {t("onboarding.welcomeTitle", "Welcome — let's set up your clinic")}
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {t(
            "onboarding.welcomeSubtitle",
            "Three short steps: name your organization, add the first branch, then open the dashboard."
          )}
        </p>
        <p className="text-xs font-medium text-[var(--color-text-tertiary)] pt-1">{stepOfLabel}</p>
      </div>

      <div
        className="flex justify-center gap-2"
        role="list"
        aria-label={t("onboarding.progressLabel", "Setup progress")}
      >
        {STEPS.map((s) => (
          <div
            key={s.id}
            role="listitem"
            aria-current={step === s.id ? "step" : undefined}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
              step === s.id
                ? "bg-primary-100 text-primary-800"
                : step > s.id
                  ? "bg-success-50 text-success-800"
                  : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]"
            }`}
          >
            <s.icon className="h-3.5 w-3.5" />
            {t(`onboarding.${s.key}`, s.fallback)}
          </div>
        ))}
      </div>

      <div className="h-1.5 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
        <div
          className="h-full bg-[var(--color-accent-primary)] transition-all duration-[var(--duration-normal)]"
          style={{ width: `${(step / STEPS.length) * 100}%` }}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{stepTitle}</CardTitle>
          <CardDescription>{stepDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <p
              role="alert"
              className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2"
            >
              {error}
            </p>
          ) : null}

          {step === 1 ? (
            <>
              <p className="text-xs leading-relaxed text-[var(--color-text-secondary)] rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-bg-secondary)] px-3 py-2">
                {t(
                  "onboarding.orgVsBranchHint",
                  "Organization is the clinic group (billing entity). Branch is the physical location patients visit — you can add more branches later."
                )}
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="onboarding-org">
                  {t("onboarding.orgName", "Organization / clinic name")}
                </label>
                <Input
                  id="onboarding-org"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Smile Dental Group"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="onboarding-owner">
                  {t("onboarding.ownerName", "Your name (owner)")}
                </label>
                <Input
                  id="onboarding-owner"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Dr. Juan Cruz"
                />
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="onboarding-branch">
                  {t("onboarding.branchName", "Branch name")}
                </label>
                <Input
                  id="onboarding-branch"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="Main Clinic"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="onboarding-address">
                  {t("onboarding.addressOptional", "Address (optional)")}
                </label>
                <Input
                  id="onboarding-address"
                  value={branchAddress}
                  onChange={(e) => setBranchAddress(e.target.value)}
                  placeholder="123 Ayala Ave, Makati City"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="onboarding-phone">
                  {t("onboarding.contactOptional", "Contact number (optional)")}
                </label>
                <Input
                  id="onboarding-phone"
                  value={branchPhone}
                  onChange={(e) => setBranchPhone(e.target.value)}
                  placeholder="+63 2 8123 4567"
                />
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <dl className="text-sm space-y-3 divide-y divide-[var(--color-border-secondary)]">
                <div className="flex justify-between pt-0">
                  <dt className="text-[var(--color-text-secondary)]">{t("onboarding.reviewOrg", "Organization")}</dt>
                  <dd className="font-medium text-[var(--color-text-primary)]">{orgName || "—"}</dd>
                </div>
                <div className="flex justify-between pt-3">
                  <dt className="text-[var(--color-text-secondary)]">{t("onboarding.reviewOwner", "Owner")}</dt>
                  <dd className="font-medium text-[var(--color-text-primary)]">{ownerName || "—"}</dd>
                </div>
                <div className="flex justify-between pt-3">
                  <dt className="text-[var(--color-text-secondary)]">{t("onboarding.reviewBranch", "Branch")}</dt>
                  <dd className="font-medium text-[var(--color-text-primary)]">{branchName || "—"}</dd>
                </div>
                {branchAddress ? (
                  <div className="flex justify-between pt-3">
                    <dt className="text-[var(--color-text-secondary)]">{t("onboarding.reviewAddress", "Address")}</dt>
                    <dd className="font-medium text-[var(--color-text-primary)] text-right max-w-[60%]">{branchAddress}</dd>
                  </div>
                ) : null}
              </dl>
              <div className="rounded-lg border border-[var(--color-border-secondary)] bg-[var(--color-bg-secondary)] p-3 text-xs space-y-2">
                <p className="font-semibold text-[var(--color-text-primary)]">
                  {t("onboarding.nextStepsTitle", "You're ready — next on the dashboard")}
                </p>
                <ol className="list-decimal pl-4 space-y-1 text-[var(--color-text-secondary)]">
                  <li>
                    {t(
                      "onboarding.nextWorkflowOn",
                      "Visit workflow defaults are enabled (check-in, served, plan → invoice). You can change them anytime in Settings → Workflow."
                    )}
                  </li>
                  <li>
                    {t(
                      "onboarding.nextFirstPatient",
                      "A short first-run guide will walk you through adding your first patient."
                    )}
                  </li>
                  <li>
                    {t(
                      "onboarding.nextOptionalLater",
                      "Optional later: clinic hours, procedures, and staff under Settings."
                    )}
                  </li>
                </ol>
              </div>
            </div>
          ) : null}

          <div className="flex justify-between pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={step === 1 || submitting}
              onClick={() => setStep((s) => s - 1)}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" /> {t("onboarding.back", "Back")}
            </Button>
            {step < 3 ? (
              <Button
                type="button"
                onClick={() => {
                  if (step === 1 && !orgName.trim()) {
                    setError(t("onboarding.orgRequired", "Organization name is required."))
                    return
                  }
                  if (step === 2 && !branchName.trim()) {
                    setError(t("onboarding.branchRequired", "Branch name is required."))
                    return
                  }
                  setError(null)
                  setStep((s) => s + 1)
                }}
                className="gap-1"
              >
                {t("onboarding.next", "Next")} <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={handleFinish} disabled={submitting} className="gap-2">
                {submitting ? t("onboarding.settingUp", "Setting up…") : t("onboarding.launch", "Launch dashboard")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
