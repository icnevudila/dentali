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
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(3.5rem,env(safe-area-inset-top))] text-neutral-900 overflow-hidden">
      {/* Background decoration */}
      <div className="landing-hero-bg absolute inset-0 pointer-events-none opacity-40" />

      <p className="absolute left-0 right-0 top-5 text-center text-sm font-bold tracking-wider text-neutral-500 select-none">
        dentali<span className="text-primary-600">.</span>
      </p>

      <div className="relative z-10 w-full max-w-lg touch-manipulation">
        {showSteps ? <KioskStepIndicator active={flowStep} /> : null}

        {step === "loading" && (
          <div className="space-y-4 text-center py-12">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary-600" />
            <p className="text-xl font-medium text-neutral-600">{t("kiosk.starting", "Starting kiosk…")}</p>
          </div>
        )}

        {step === "error" && (
          <div className="space-y-6 rounded-3xl border border-neutral-100 bg-white/85 p-8 text-center shadow-xl backdrop-blur-md">
            <AlertCircle className="mx-auto h-16 w-16 text-amber-500" />
            <h1 className="text-2xl font-extrabold text-neutral-900">{t("kiosk.seeFrontDesk", "Please see the front desk")}</h1>
            <p className="text-lg text-neutral-600 leading-relaxed">{errorMsg}</p>
            <Link href="/login" className="inline-block mt-2 text-sm font-semibold text-primary-600 hover:text-primary-700 underline transition">
              {t("kiosk.staffLogin", "Staff login")}
            </Link>
          </div>
        )}

        {step === "welcome" && (
          <div className="space-y-6 rounded-3xl border border-neutral-100 bg-white/85 p-8 text-center shadow-xl backdrop-blur-md">
            <div className="inline-flex rounded-full border border-primary-200 bg-primary-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-primary-700">
              {branchName || "dentali. clinic"}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-widest text-primary-600">
                {t("kiosk.welcomeTo", "Welcome to")}
              </p>
              <h1 className="text-3xl font-extrabold text-neutral-900">{branchName || "dentali."}</h1>
            </div>
            <p className="text-lg text-neutral-600 leading-relaxed">
              {t("kiosk.checkInPrompt", "Tap below to check in for your appointment.")}
            </p>
            <div className="space-y-3 pt-2">
              <button 
                onClick={() => setStep("form")}
                className="w-full h-16 text-xl font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-2xl shadow-lg shadow-primary-500/20 transition duration-200 active:scale-98"
              >
                {t("kiosk.checkInNow", "Check in now")}
              </button>
              <button
                onClick={() => setStep("intakeForm")}
                className="w-full h-14 text-lg font-bold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-xl transition duration-200 active:scale-98"
              >
                {t("kiosk.newPatient", "New patient registration")}
              </button>
            </div>
            <Link href="/login" className="block text-xs font-bold uppercase tracking-wider text-neutral-400 hover:text-primary-600 transition pt-2">
              {t("kiosk.staffLogin", "Staff login")}
            </Link>
          </div>
        )}

        {step === "form" && (
          <div className="rounded-3xl border border-neutral-100 bg-white/85 p-8 shadow-xl backdrop-blur-md">
            <div className="mb-6">
              <h1 className="text-2xl font-extrabold text-neutral-900">{t("kiosk.checkInTitle", "Check in")}</h1>
              <p className="text-sm text-neutral-500 mt-1">
                {t("kiosk.checkInHint", "Enter the phone number and last name on your record.")}
              </p>
            </div>
            <form onSubmit={handleCheckIn} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  {t("kiosk.mobileNumber", "Mobile number")}
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  required
                  placeholder="e.g. +1 XXX XXX XXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  autoFocus
                  className="w-full h-14 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-lg text-neutral-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  {t("kiosk.lastName", "Last name")}
                </label>
                <input
                  required
                  placeholder="Santos"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  className="w-full h-14 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-lg text-neutral-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
                />
              </div>
              {errorMsg ? (
                <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-center text-xs font-semibold text-red-600">
                  {errorMsg}
                </div>
              ) : null}
              <button 
                type="submit" 
                disabled={submitting}
                className="w-full h-14 text-lg font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-lg shadow-primary-500/10 transition duration-200 active:scale-98 disabled:opacity-50"
              >
                {submitting
                  ? t("kiosk.checkingIn", "Checking in…")
                  : t("kiosk.confirmCheckIn", "Confirm check-in")}
              </button>
              <button 
                type="button" 
                onClick={resetToWelcome}
                className="w-full h-10 text-sm font-semibold text-neutral-500 hover:text-neutral-700 transition"
              >
                {t("kiosk.back", "Back")}
              </button>
            </form>
          </div>
        )}

        {step === "intakeForm" && (
          <div className="rounded-3xl border border-neutral-100 bg-white/85 p-8 shadow-xl backdrop-blur-md">
            <div className="mb-6">
              <h1 className="text-2xl font-extrabold text-neutral-900">{t("kiosk.intakeTitle", "Patient registration")}</h1>
              <p className="text-sm text-neutral-500 mt-1">
                {t(
                  "kiosk.intakeHint",
                  "Fill in your details. Front desk will review before creating your record."
                )}
              </p>
            </div>
            <form onSubmit={handleIntakeSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">{t("kiosk.firstName", "First name")}</label>
                  <input
                    required
                    placeholder="Maria"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                    autoFocus
                    className="w-full h-12 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-base text-neutral-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">{t("kiosk.lastName", "Last name")}</label>
                  <input
                    required
                    placeholder="Santos"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="family-name"
                    className="w-full h-12 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-base text-neutral-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  {t("kiosk.mobileNumber", "Mobile number")}
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="e.g. +1 XXX XXX XXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  className="w-full h-12 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-base text-neutral-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">{t("kiosk.email", "Email")}</label>
                <input
                  type="email"
                  inputMode="email"
                  placeholder="maria@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="w-full h-12 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-base text-neutral-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
                />
              </div>
              {errorMsg ? (
                <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-center text-xs font-semibold text-red-600">
                  {errorMsg}
                </div>
              ) : null}
              <button 
                type="submit" 
                disabled={submitting}
                className="w-full h-14 mt-2 text-lg font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-lg shadow-primary-500/10 transition duration-200 active:scale-98 disabled:opacity-50"
              >
                {submitting
                  ? t("kiosk.submitting", "Submitting…")
                  : t("kiosk.submitIntake", "Submit registration")}
              </button>
              <button 
                type="button" 
                onClick={resetToWelcome}
                className="w-full h-10 text-sm font-semibold text-neutral-500 hover:text-neutral-700 transition"
              >
                {t("kiosk.back", "Back")}
              </button>
            </form>
          </div>
        )}

        {step === "success" && (
          <div className="space-y-6 rounded-3xl border border-neutral-100 bg-white/85 p-8 text-center shadow-xl backdrop-blur-md">
            <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500 animate-bounce" />
            <h1 className="text-2xl font-extrabold text-neutral-900">{t("kiosk.checkedIn", "You're checked in!")}</h1>
            <div className="rounded-2xl border border-primary-100 bg-primary-50/50 py-6">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-neutral-500">{t("kiosk.queueNumber", "Your queue number")}</p>
              <p className="font-mono text-5xl font-extrabold text-primary-700">{queueCode}</p>
            </div>
            <p className="text-neutral-600 text-base leading-relaxed">
              {t("kiosk.waitMessage", "Please take a seat. We will call your number when ready.")}
            </p>
            <div className="space-y-1 text-xs text-neutral-400 font-semibold border-t border-neutral-100 pt-4">
              <p>{t("kiosk.autoResetHint", "This screen will reset automatically for the next patient.")}</p>
              <p>{t("kiosk.idleResetHint", "Forms reset after 2 minutes of inactivity.")}</p>
            </div>
            <button 
              onClick={resetToWelcome}
              className="w-full h-12 font-bold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-xl transition duration-200 active:scale-98"
            >
              {t("kiosk.done", "Done")}
            </button>
          </div>
        )}

        {step === "intakeSuccess" && (
          <div className="space-y-6 rounded-3xl border border-neutral-100 bg-white/85 p-8 text-center shadow-xl backdrop-blur-md">
            <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500 animate-bounce" />
            <h1 className="text-2xl font-extrabold text-neutral-900">{t("kiosk.intakeSuccess", "Registration submitted!")}</h1>
            <p className="text-neutral-600 text-base leading-relaxed">
              {t("kiosk.intakeSuccessHint", "Please see the front desk to complete your file.")}
            </p>
            <div className="space-y-1 text-xs text-neutral-400 font-semibold border-t border-neutral-100 pt-4">
              <p>{t("kiosk.autoResetHint", "This screen will reset automatically for the next patient.")}</p>
              <p>{t("kiosk.idleResetHint", "Forms reset after 2 minutes of inactivity.")}</p>
            </div>
            <button 
              onClick={resetToWelcome}
              className="w-full h-12 font-bold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-xl transition duration-200 active:scale-98"
            >
              {t("kiosk.done", "Done")}
            </button>
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
        <div className="flex min-h-screen items-center justify-center bg-white text-neutral-600">
          <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
        </div>
      }
    >
      <KioskContent />
    </Suspense>
  )
}
