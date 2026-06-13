"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { createKioskSession, submitKioskCheckin, submitKioskIntake } from "@/lib/kiosk/kiosk-service"
import { useLocale } from "@/hooks/use-locale"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { KioskStepIndicator, kioskStepFromFlow } from "@/components/kiosk/KioskStepIndicator"
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react"

type Step = "loading" | "welcome" | "form" | "success" | "error" | "intakeForm" | "intakeSuccess"

const AUTO_RESET_MS = 45_000
const FORM_IDLE_MS = 120_000

function KioskContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const { t } = useLocale()

  const [step, setStep] = React.useState<Step>("loading")
  const [branchName, setBranchName] = React.useState("")
  const [sessionId, setSessionId] = React.useState("")
  const [errorMsg, setErrorMsg] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [lastName, setLastName] = React.useState("")
  const [firstName, setFirstName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [queueCode, setQueueCode] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  const resetToWelcome = React.useCallback(() => {
    setStep("welcome")
    setPhone("")
    setLastName("")
    setFirstName("")
    setEmail("")
    setErrorMsg("")
    setQueueCode("")
  }, [])

  React.useEffect(() => {
    if (!token) {
      setStep("error")
      setErrorMsg(t("kiosk.invalidLink", "Invalid kiosk link. Please ask the front desk for assistance."))
      return
    }

    createKioskSession(token).then(({ data, error }) => {
      if (error || !data) {
        setStep("error")
        setErrorMsg(error ?? t("kiosk.sessionFailed", "Unable to start kiosk session."))
        return
      }
      setSessionId(data.session_id)
      setBranchName(data.branch_name)
      setStep("welcome")
    })
  }, [token, t])

  React.useEffect(() => {
    if (step !== "success" && step !== "intakeSuccess") return
    const id = setTimeout(resetToWelcome, AUTO_RESET_MS)
    return () => clearTimeout(id)
  }, [step, resetToWelcome])

  React.useEffect(() => {
    if (step !== "form" && step !== "intakeForm") return
    const id = setTimeout(resetToWelcome, FORM_IDLE_MS)
    return () => clearTimeout(id)
  }, [step, phone, lastName, firstName, email, resetToWelcome])

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg("")
    const { data, error } = await submitKioskCheckin(sessionId, phone, lastName)
    setSubmitting(false)
    if (error || !data) {
      setErrorMsg(error ?? t("kiosk.checkInFailed", "Check-in failed. Please see the front desk."))
      return
    }
    setQueueCode(data.display_code)
    setStep("success")
  }

  const handleIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg("")
    const { error } = await submitKioskIntake(sessionId, {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
    })
    setSubmitting(false)
    if (error) {
      setErrorMsg(error)
      return
    }
    setStep("intakeSuccess")
  }

  const showSteps = step !== "loading" && step !== "error"
  const flowStep = kioskStepFromFlow(step)

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-b from-primary-800 to-primary-700 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(3.5rem,env(safe-area-inset-top))] text-white">
      <p className="absolute left-0 right-0 top-5 text-center text-sm font-bold tracking-tight text-white/90">
        dentali.
      </p>
      <div className="w-full max-w-lg touch-manipulation">
        {showSteps ? <KioskStepIndicator active={flowStep} /> : null}

        {step === "loading" && (
          <div className="space-y-4 text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin opacity-80" />
            <p className="text-xl">{t("kiosk.starting", "Starting kiosk…")}</p>
          </div>
        )}

        {step === "error" && (
          <div className="space-y-4 rounded-2xl bg-white/10 p-8 text-center backdrop-blur">
            <AlertCircle className="mx-auto h-16 w-16 text-amber-300" />
            <h1 className="text-2xl font-bold">{t("kiosk.seeFrontDesk", "Please see the front desk")}</h1>
            <p className="text-lg text-primary-100">{errorMsg}</p>
            <Link href="/login" className="mt-4 inline-block text-sm text-primary-200 underline">
              {t("kiosk.staffLogin", "Staff login")}
            </Link>
          </div>
        )}

        {step === "welcome" && (
          <div className="space-y-6 rounded-2xl bg-white p-8 text-center text-neutral-900 shadow-xl">
            <div className="inline-flex rounded-full bg-primary-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary-700">
              {branchName}
            </div>
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-primary-600">
                {t("kiosk.welcomeTo", "Welcome to")}
              </p>
              <h1 className="mt-1 text-3xl font-bold">{branchName}</h1>
            </div>
            <p className="text-lg text-neutral-600">
              {t("kiosk.checkInPrompt", "Tap below to check in for your appointment.")}
            </p>
            <div className="space-y-3">
              <Button size="lg" className="h-16 w-full text-xl" onClick={() => setStep("form")}>
                {t("kiosk.checkInNow", "Check in now")}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-14 w-full text-lg"
                onClick={() => setStep("intakeForm")}
              >
                {t("kiosk.newPatient", "New patient registration")}
              </Button>
            </div>
            <Link href="/login" className="block text-sm text-neutral-400 hover:text-neutral-600">
              {t("kiosk.staffLogin", "Staff login")}
            </Link>
          </div>
        )}

        {step === "form" && (
          <div className="rounded-2xl bg-white p-8 text-neutral-900 shadow-xl">
            <h1 className="mb-2 text-2xl font-bold">{t("kiosk.checkInTitle", "Check in")}</h1>
            <p className="mb-6 text-neutral-500">
              {t("kiosk.checkInHint", "Enter the phone number and last name on your record.")}
            </p>
            <form onSubmit={handleCheckIn} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  {t("kiosk.mobileNumber", "Mobile number")}
                </label>
                <Input
                  type="tel"
                  inputMode="tel"
                  required
                  className="h-14 text-lg"
                  placeholder="09XX XXX XXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">{t("kiosk.lastName", "Last name")}</label>
                <Input
                  required
                  className="h-14 text-lg"
                  placeholder="Santos"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                />
              </div>
              {errorMsg ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {errorMsg}
                </p>
              ) : null}
              <Button type="submit" size="lg" className="h-14 w-full text-lg" disabled={submitting}>
                {submitting
                  ? t("kiosk.checkingIn", "Checking in…")
                  : t("kiosk.confirmCheckIn", "Confirm check-in")}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={resetToWelcome}>
                {t("kiosk.back", "Back")}
              </Button>
            </form>
          </div>
        )}

        {step === "intakeForm" && (
          <div className="rounded-2xl bg-white p-8 text-neutral-900 shadow-xl">
            <h1 className="mb-2 text-2xl font-bold">{t("kiosk.intakeTitle", "Patient registration")}</h1>
            <p className="mb-6 text-neutral-500">
              {t(
                "kiosk.intakeHint",
                "Fill in your details. Front desk will review before creating your record."
              )}
            </p>
            <form onSubmit={handleIntakeSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium">{t("kiosk.firstName", "First name")}</label>
                <Input
                  required
                  className="h-14 text-lg"
                  placeholder="Maria"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">{t("kiosk.lastName", "Last name")}</label>
                <Input
                  required
                  className="h-14 text-lg"
                  placeholder="Santos"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">
                  {t("kiosk.mobileNumber", "Mobile number")}
                </label>
                <Input
                  type="tel"
                  inputMode="tel"
                  className="h-14 text-lg"
                  placeholder="09XX XXX XXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">{t("kiosk.email", "Email")}</label>
                <Input
                  type="email"
                  inputMode="email"
                  className="h-14 text-lg"
                  placeholder="maria@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              {errorMsg ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {errorMsg}
                </p>
              ) : null}
              <Button type="submit" size="lg" className="h-14 w-full text-lg" disabled={submitting}>
                {submitting
                  ? t("kiosk.submitting", "Submitting…")
                  : t("kiosk.submitIntake", "Submit registration")}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={resetToWelcome}>
                {t("kiosk.back", "Back")}
              </Button>
            </form>
          </div>
        )}

        {step === "success" && (
          <div className="space-y-6 rounded-2xl bg-white p-8 text-center text-neutral-900 shadow-xl">
            <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
            <h1 className="text-2xl font-bold">{t("kiosk.checkedIn", "You're checked in!")}</h1>
            <div className="rounded-xl bg-primary-50 py-6">
              <p className="mb-1 text-sm text-neutral-500">{t("kiosk.queueNumber", "Your queue number")}</p>
              <p className="font-mono text-5xl font-bold text-primary-700">{queueCode}</p>
            </div>
            <p className="text-neutral-600">
              {t("kiosk.waitMessage", "Please take a seat. We will call your number when ready.")}
            </p>
            <p className="text-xs text-neutral-400">
              {t("kiosk.autoResetHint", "This screen will reset automatically for the next patient.")}
            </p>
            <p className="text-xs text-neutral-400">
              {t("kiosk.idleResetHint", "Forms reset after 2 minutes of inactivity.")}
            </p>
            <Button variant="outline" className="h-12 w-full" onClick={resetToWelcome}>
              {t("kiosk.done", "Done")}
            </Button>
          </div>
        )}

        {step === "intakeSuccess" && (
          <div className="space-y-6 rounded-2xl bg-white p-8 text-center text-neutral-900 shadow-xl">
            <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
            <h1 className="text-2xl font-bold">{t("kiosk.intakeSuccess", "Registration submitted!")}</h1>
            <p className="text-neutral-600">
              {t("kiosk.intakeSuccessHint", "Please see the front desk to complete your file.")}
            </p>
            <p className="text-xs text-neutral-400">
              {t("kiosk.autoResetHint", "This screen will reset automatically for the next patient.")}
            </p>
            <p className="text-xs text-neutral-400">
              {t("kiosk.idleResetHint", "Forms reset after 2 minutes of inactivity.")}
            </p>
            <Button variant="outline" className="h-12 w-full" onClick={resetToWelcome}>
              {t("kiosk.done", "Done")}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function KioskPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-primary-700 text-white">
          <Loader2 className="h-10 w-10 animate-spin" />
        </div>
      }
    >
      <KioskContent />
    </Suspense>
  )
}
