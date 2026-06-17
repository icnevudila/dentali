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
import { KioskConsentStep } from "@/components/kiosk/KioskConsentStep"
import {
  fetchKioskConsentSnapshot,
  hasPendingKioskConsents,
  type PortalSnapshot,
} from "@/lib/kiosk/kiosk-consent-service"
import { readKioskSignReturn } from "@/lib/kiosk/kiosk-sign-return"
import { PublicChannelBrand } from "@/components/brand/public-channel-brand"
import { CheckCircle2, AlertCircle, Loader2, Users, MapPin } from "lucide-react"
import { updateKioskMood, getKioskQueueStats } from "@/lib/kiosk/kiosk-service"

type Step = "loading" | "welcome" | "form" | "consents" | "mood" | "success" | "error" | "intakeForm" | "intakeSuccess" | "pending_approval"

const AUTO_RESET_MS = 8_000
const FORM_IDLE_MS = 120_000

function KioskContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const resume = searchParams.get("resume")
  const { t } = useLocale()

  const [step, setStep] = React.useState<Step>("loading")
  const [branchName, setBranchName] = React.useState("")
  const [branchId, setBranchId] = React.useState("")
  const [sessionId, setSessionId] = React.useState("")
  const [errorMsg, setErrorMsg] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [lastName, setLastName] = React.useState("")
  const [firstName, setFirstName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [queueCode, setQueueCode] = React.useState("")
  const [entryId, setEntryId] = React.useState("")
  const [intakeId, setIntakeId] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [isScreensaver, setIsScreensaver] = React.useState(false)
  const [liveQueue, setLiveQueue] = React.useState<{ serving: string[]; waitCount: number } | null>(null)
  const [consentSnapshot, setConsentSnapshot] = React.useState<PortalSnapshot | null>(null)

  const resetToWelcome = React.useCallback(() => {
    setStep("welcome")
    setPhone("")
    setLastName("")
    setFirstName("")
    setEmail("")
    setErrorMsg("")
    setQueueCode("")
    setEntryId("")
    setIntakeId("")
    setConsentSnapshot(null)
  }, [])

  React.useEffect(() => {
    if (!token) {
      setStep("error")
      setErrorMsg(t("kiosk.invalidLink", "Invalid kiosk link. Please ask the front desk for assistance."))
      return
    }

    createKioskSession(token).then(async ({ data, error }) => {
      if (error || !data) {
        setStep("error")
        setErrorMsg(error ?? t("kiosk.sessionFailed", "Unable to start kiosk session."))
        return
      }
      setSessionId(data.session_id)
      setBranchName(data.branch_name)
      setBranchId(data.branch_id)

      const saved = resume === "consents" ? readKioskSignReturn(token) : null
      if (saved) {
        setPhone(saved.phone)
        setLastName(saved.lastName)
        const { data: snapshot, error: snapError } = await fetchKioskConsentSnapshot(
          data.session_id,
          saved.phone,
          saved.lastName
        )
        if (!snapError && snapshot) {
          setConsentSnapshot(snapshot)
          setStep("consents")
          return
        }
      }

      setStep("welcome")
    })
  }, [token, resume, t])

  React.useEffect(() => {
    if (step !== "success" && step !== "intakeSuccess" && step !== "pending_approval") return
    const id = setTimeout(resetToWelcome, AUTO_RESET_MS)
    return () => clearTimeout(id)
  }, [step, resetToWelcome])

  React.useEffect(() => {
    if (step !== "form" && step !== "intakeForm" && step !== "consents") return
    const id = setTimeout(resetToWelcome, FORM_IDLE_MS)
    return () => clearTimeout(id)
  }, [step, phone, lastName, firstName, email, resetToWelcome])

  // Idle timer for screensaver
  React.useEffect(() => {
    if (step !== "welcome") {
      setIsScreensaver(false)
      return
    }
    const id = setTimeout(() => setIsScreensaver(true), 120_000) // 2 mins idle
    return () => clearTimeout(id)
  }, [step])

  // Click anywhere to wake up screensaver
  React.useEffect(() => {
    if (!isScreensaver) return
    const wakeUp = () => setIsScreensaver(false)
    window.addEventListener("touchstart", wakeUp)
    window.addEventListener("mousedown", wakeUp)
    return () => {
      window.removeEventListener("touchstart", wakeUp)
      window.removeEventListener("mousedown", wakeUp)
    }
  }, [isScreensaver])

  // Fetch live queue stats
  React.useEffect(() => {
    if (!branchId) return
    const fetchQueue = () => {
      getKioskQueueStats(branchId).then(({ data }) => {
        if (data) setLiveQueue(data)
      })
    }
    fetchQueue()
    const id = setInterval(fetchQueue, 15_000)
    return () => clearInterval(id)
  }, [branchId])

  const playSuccessSound = (speechText?: string) => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext
      if (AudioContext) {
        const ctx = new AudioContext()
        const osc = ctx.createOscillator()
        const gainNode = ctx.createGain()

        osc.type = "sine"
        osc.frequency.setValueAtTime(523.25, ctx.currentTime) // C5
        osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.1) // C6

        gainNode.gain.setValueAtTime(0, ctx.currentTime)
        gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)

        osc.connect(gainNode)
        gainNode.connect(ctx.destination)

        osc.start()
        osc.stop(ctx.currentTime + 0.5)
      }

      if (speechText && "speechSynthesis" in window) {
        setTimeout(() => {
          // Cancel any ongoing speech
          window.speechSynthesis.cancel()
          const utterance = new SpeechSynthesisUtterance(speechText)
          utterance.lang = "en-US"
          utterance.rate = 0.95 // Slightly slower and clearer
          window.speechSynthesis.speak(utterance)
        }, 300)
      }
    } catch (e) {
      // Ignore audio errors
    }
  }

  const playPendingSound = React.useCallback((speechText: string) => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext
      if (AudioContext) {
        const ctx = new AudioContext()
        const osc = ctx.createOscillator()
        const gainNode = ctx.createGain()

        osc.type = "triangle"
        osc.frequency.setValueAtTime(440, ctx.currentTime) // A4
        osc.frequency.setValueAtTime(554.37, ctx.currentTime + 0.15) // C#5

        gainNode.gain.setValueAtTime(0, ctx.currentTime)
        gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6)

        osc.connect(gainNode)
        gainNode.connect(ctx.destination)

        osc.start()
        osc.stop(ctx.currentTime + 0.6)
      }

      if ("speechSynthesis" in window) {
        setTimeout(() => {
          window.speechSynthesis.cancel()
          const utterance = new SpeechSynthesisUtterance(speechText)
          utterance.lang = "tr-TR"
          utterance.rate = 0.9
          window.speechSynthesis.speak(utterance)
        }, 400)
      }
    } catch {
      // Ignore
    }
  }, [])

  const performCheckIn = React.useCallback(async () => {
    setSubmitting(true)
    setErrorMsg("")
    const { data, error } = await submitKioskCheckin(sessionId, phone, lastName)
    setSubmitting(false)
    if (error || !data) {
      if (error && error.includes("REGISTRATION_PENDING")) {
        setStep("pending_approval")
        playPendingSound(
          t(
            "kiosk.speechPending",
            "Your registration has been received but is pending approval at the front desk. Kaydınız alınmıştır ancak henüz banko tarafından onaylanmamıştır."
          )
        )
      } else if (error && /intake forms|sign intake/i.test(error)) {
        const { data: snapshot, error: snapError } = await fetchKioskConsentSnapshot(
          sessionId,
          phone,
          lastName
        )
        if (!snapError && snapshot && hasPendingKioskConsents(snapshot)) {
          setConsentSnapshot(snapshot)
          setStep("consents")
          setErrorMsg("")
        } else {
          setErrorMsg(error ?? t("kiosk.checkInFailed", "Check-in failed. Please see the front desk."))
        }
      } else {
        setErrorMsg(error ?? t("kiosk.checkInFailed", "Check-in failed. Please see the front desk."))
      }
      return
    }
    setQueueCode(data.display_code)
    if (data.entry_id) setEntryId(data.entry_id)
    setStep("mood")
  }, [sessionId, phone, lastName, t, playPendingSound])

  const handleAllConsentsSigned = React.useCallback(() => {
    void performCheckIn()
  }, [performCheckIn])

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg("")

    const { data: snapshot, error } = await fetchKioskConsentSnapshot(sessionId, phone, lastName)
    setSubmitting(false)

    if (error || !snapshot) {
      if (error?.includes("REGISTRATION_PENDING")) {
        setStep("pending_approval")
        playPendingSound(
          t(
            "kiosk.speechPending",
            "Your registration has been received but is pending approval at the front desk. Kaydınız alınmıştır ancak henüz banko tarafından onaylanmamıştır."
          )
        )
        return
      }
      setErrorMsg(error ?? t("kiosk.checkInFailed", "Check-in failed. Please see the front desk."))
      return
    }

    if (hasPendingKioskConsents(snapshot)) {
      setConsentSnapshot(snapshot)
      setStep("consents")
      return
    }

    await performCheckIn()
  }

  const handleMoodSelect = async (mood: string) => {
    if (entryId) {
      await updateKioskMood(entryId, mood)
    }
    setStep("success")
    playSuccessSound(t("kiosk.speechCheckIn", `Check-in successful. Your queue number is ${queueCode.split('').join(' ')}`))
  }

  const handleIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg("")
    const { data, error } = await submitKioskIntake(sessionId, {
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
    if (data?.intake_id) {
      setIntakeId(data.intake_id)
    }
    setStep("intakeSuccess")
    playSuccessSound(t("kiosk.speechIntake", "Registration received. Please wait for the front desk."))
  }

  const showSteps = step !== "loading" && step !== "error"
  const flowStep = kioskStepFromFlow(step)

  if (isScreensaver) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-teal-950 text-white cursor-pointer transition-opacity duration-1000 animate-in fade-in">
        <div className="absolute inset-0 overflow-hidden opacity-20 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-teal-400 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-400 blur-[120px] animate-pulse" style={{ animationDuration: '10s' }} />
        </div>
        <div className="z-10 flex flex-col items-center gap-6 animate-float">
          <PublicChannelBrand variant="screensaver" />
          <h1 className="text-4xl font-light tracking-wide text-teal-50">Welcome to <span className="font-semibold text-white">{branchName || "Our Clinic"}</span></h1>
          <p className="mt-8 rounded-full border border-teal-500/30 bg-teal-900/50 px-6 py-2 text-teal-200 backdrop-blur-sm animate-pulse">
            Tap anywhere to start
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-primary-50 via-white to-primary-100 p-6 font-sans text-neutral-900 antialiased selection:bg-primary-100 selection:text-primary-900">
      {/* Dynamic Background Elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-[10%] -top-[10%] h-[40%] w-[40%] rounded-full bg-primary-300/30 blur-[100px] sm:blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] h-[40%] w-[40%] rounded-full bg-primary-400/20 blur-[100px] sm:blur-[120px]" />
      </div>

      {/* Live Queue Widget */}
      {step === "welcome" && liveQueue && (
        <div className="absolute top-6 right-6 z-40 animate-fade-in">
          <div className="flex items-center gap-3 rounded-full border border-white/60 bg-white/40 p-2 pr-4 shadow-sm backdrop-blur-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500 text-white shadow-inner">
              <Users className="h-5 w-5" />
            </div>
            <div className="flex flex-col text-sm">
              <span className="font-medium text-neutral-800 leading-tight">
                Currently Serving: {liveQueue.serving.length > 0 ? liveQueue.serving.join(", ") : "None"}
              </span>
              <span className="text-xs text-neutral-500 font-medium">
                {liveQueue.waitCount} waiting
              </span>
            </div>
          </div>
        </div>
      )}

      <PublicChannelBrand variant="header" />

      <div className="relative z-10 w-full max-w-lg touch-manipulation transition-all duration-500 ease-out">
        {showSteps ? <KioskStepIndicator active={flowStep} /> : null}

        {step === "loading" && (
          <div className="space-y-4 text-center py-12 animate-in fade-in zoom-in duration-500">
            <Loader2 className="mx-auto h-14 w-14 animate-spin text-primary-500" />
            <p className="text-xl font-medium text-neutral-600">{t("kiosk.starting", "Starting kiosk…")}</p>
          </div>
        )}

        {step === "error" && (
          <div className="space-y-6 rounded-3xl border border-white bg-white/80 p-10 text-center shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-8 duration-500">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-10 w-10 text-red-500" />
            </div>
            <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">{t("kiosk.seeFrontDesk", "Please see the front desk")}</h1>
            <p className="text-lg text-neutral-600 leading-relaxed">{errorMsg}</p>
          </div>
        )}

        {step === "welcome" && (
          <div className="space-y-8 rounded-[2rem] border border-white bg-white/70 p-10 text-center shadow-[0_8px_40px_rgb(0,0,0,0.08)] backdrop-blur-2xl animate-in slide-in-from-bottom-4 duration-500">
            <div className="inline-flex rounded-full border border-primary-200 bg-primary-50/80 px-5 py-2 text-xs font-bold uppercase tracking-widest text-primary-700 shadow-sm">
              {branchName || t("kiosk.defaultClinic", "Our clinic")}
            </div>
            <div className="space-y-3">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary-600/80">
                {t("kiosk.welcomeTo", "Welcome to")}
              </p>
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-neutral-900 bg-clip-text text-transparent bg-gradient-to-r from-neutral-900 to-neutral-600">
                {branchName || t("kiosk.defaultClinic", "Our clinic")}
              </h1>
            </div>
            <p className="text-lg text-neutral-600 leading-relaxed font-medium px-4">
              {t("kiosk.checkInPrompt", "Tap below to check in for your appointment.")}
            </p>
            <div className="space-y-4 pt-4">
              <button 
                onClick={() => setStep("form")}
                className="group relative w-full h-16 text-xl font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-2xl shadow-lg shadow-primary-500/30 transition-all duration-300 active:scale-[0.98] overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-[-100%] group-hover:translate-y-[100%] transition-transform duration-700 ease-in-out" />
                {t("kiosk.checkInNow", "Check in now")}
              </button>
              <button
                onClick={() => setStep("intakeForm")}
                className="w-full h-14 text-lg font-bold text-neutral-600 bg-white/80 border-2 border-transparent hover:border-primary-100 hover:bg-white rounded-xl shadow-sm transition-all duration-200 active:scale-[0.98]"
              >
                {t("kiosk.newPatient", "New patient registration")}
              </button>
            </div>
          </div>
        )}

        {step === "form" && (
          <div className="rounded-[2rem] border border-white bg-white/70 p-10 shadow-[0_8px_40px_rgb(0,0,0,0.08)] backdrop-blur-2xl animate-in slide-in-from-bottom-4 duration-500">
            <div className="mb-8 text-center">
              <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">{t("kiosk.checkInTitle", "Check in")}</h1>
              <p className="text-base text-neutral-500 mt-2">
                {t("kiosk.checkInHint", "Enter the phone number and last name on your record.")}
              </p>
            </div>
            <form onSubmit={handleCheckIn} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-neutral-500 ml-1">
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
                  className="w-full h-16 rounded-2xl border-2 border-transparent bg-white/80 px-5 py-3 text-xl text-neutral-900 shadow-sm placeholder:text-neutral-300 outline-none transition-all focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 hover:bg-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-neutral-500 ml-1">
                  {t("kiosk.lastName", "Last name")}
                </label>
                <input
                  required
                  placeholder="Santos"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  className="w-full h-16 rounded-2xl border-2 border-transparent bg-white/80 px-5 py-3 text-xl text-neutral-900 shadow-sm placeholder:text-neutral-300 outline-none transition-all focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 hover:bg-white"
                />
              </div>
              {errorMsg ? (
                <div className="rounded-2xl bg-red-50/80 border border-red-100 p-4 text-center text-sm font-semibold text-red-600 animate-in fade-in slide-in-from-top-2">
                  {errorMsg}
                </div>
              ) : null}
              <div className="pt-2 space-y-4">
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="group relative w-full h-16 text-xl font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-2xl shadow-lg shadow-primary-500/30 transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-[-100%] group-hover:translate-y-[100%] transition-transform duration-700 ease-in-out" />
                  {submitting
                    ? t("kiosk.checkingIn", "Checking in…")
                    : t("kiosk.confirmCheckIn", "Confirm check-in")}
                </button>
                <button 
                  type="button" 
                  onClick={resetToWelcome}
                  className="w-full h-12 text-base font-bold text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100/50 rounded-xl transition-all active:scale-[0.98]"
                >
                  {t("kiosk.back", "Back")}
                </button>
              </div>
            </form>
          </div>
        )}

        {step === "intakeForm" && (
          <div className="rounded-[2rem] border border-white bg-white/70 p-10 shadow-[0_8px_40px_rgb(0,0,0,0.08)] backdrop-blur-2xl animate-in slide-in-from-bottom-4 duration-500">
            <div className="mb-8 text-center">
              <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">{t("kiosk.intakeTitle", "Patient registration")}</h1>
              <p className="text-base text-neutral-500 mt-2">
                {t(
                  "kiosk.intakeHint",
                  "Fill in your details. Front desk will review before creating your record."
                )}
              </p>
            </div>
            <form onSubmit={handleIntakeSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-neutral-500 ml-1">{t("kiosk.firstName", "First name")}</label>
                  <input
                    required
                    placeholder="Maria"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                    autoFocus
                    className="w-full h-14 rounded-2xl border-2 border-transparent bg-white/80 px-5 py-3 text-lg text-neutral-900 shadow-sm placeholder:text-neutral-300 outline-none transition-all focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 hover:bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-neutral-500 ml-1">{t("kiosk.lastName", "Last name")}</label>
                  <input
                    required
                    placeholder="Santos"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="family-name"
                    className="w-full h-14 rounded-2xl border-2 border-transparent bg-white/80 px-5 py-3 text-lg text-neutral-900 shadow-sm placeholder:text-neutral-300 outline-none transition-all focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 hover:bg-white"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-neutral-500 ml-1">
                  {t("kiosk.mobileNumber", "Mobile number")}
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="e.g. +1 XXX XXX XXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  className="w-full h-14 rounded-2xl border-2 border-transparent bg-white/80 px-5 py-3 text-lg text-neutral-900 shadow-sm placeholder:text-neutral-300 outline-none transition-all focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 hover:bg-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-neutral-500 ml-1">{t("kiosk.email", "Email")}</label>
                <input
                  type="email"
                  inputMode="email"
                  placeholder="maria@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="w-full h-14 rounded-2xl border-2 border-transparent bg-white/80 px-5 py-3 text-lg text-neutral-900 shadow-sm placeholder:text-neutral-300 outline-none transition-all focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 hover:bg-white"
                />
              </div>
              {errorMsg ? (
                <div className="rounded-2xl bg-red-50/80 border border-red-100 p-4 text-center text-sm font-semibold text-red-600 animate-in fade-in slide-in-from-top-2">
                  {errorMsg}
                </div>
              ) : null}
              <div className="pt-2 space-y-4">
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="group relative w-full h-16 text-xl font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-2xl shadow-lg shadow-primary-500/30 transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-[-100%] group-hover:translate-y-[100%] transition-transform duration-700 ease-in-out" />
                  {submitting
                    ? t("kiosk.submitting", "Submitting…")
                    : t("kiosk.submitIntake", "Submit registration")}
                </button>
                <button 
                  type="button" 
                  onClick={resetToWelcome}
                  className="w-full h-12 text-base font-bold text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100/50 rounded-xl transition-all active:scale-[0.98]"
                >
                  {t("kiosk.back", "Back")}
                </button>
              </div>
            </form>
          </div>
        )}

        {step === "consents" && sessionId ? (
          <KioskConsentStep
            kioskToken={token}
            sessionId={sessionId}
            phone={phone}
            lastName={lastName}
            branchName={branchName}
            initialSnapshot={consentSnapshot}
            onBack={() => setStep("form")}
            onAllSigned={handleAllConsentsSigned}
          />
        ) : null}

        {step === "mood" && (
          <div className="rounded-[2rem] border border-white bg-white/70 p-10 text-center shadow-[0_8px_40px_rgb(0,0,0,0.08)] backdrop-blur-2xl animate-in slide-in-from-bottom-8 fade-in duration-500">
            <h2 className="mb-2 text-3xl font-semibold tracking-tight text-neutral-900">
              How are you feeling today?
            </h2>
            <p className="mb-8 text-neutral-500">Let your dentist know so we can make you comfortable.</p>

            <div className="flex justify-center gap-6">
              <button
                onClick={() => handleMoodSelect('anxious')}
                className="group flex flex-col items-center gap-3 rounded-2xl border border-neutral-100 bg-white p-6 shadow-sm transition-all hover:scale-105 hover:border-blue-200 hover:bg-blue-50 hover:shadow-md active:scale-95"
              >
                <span className="text-5xl group-hover:animate-bounce">😰</span>
                <span className="font-medium text-neutral-600">A bit anxious</span>
              </button>

              <button
                onClick={() => handleMoodSelect('normal')}
                className="group flex flex-col items-center gap-3 rounded-2xl border border-neutral-100 bg-white p-6 shadow-sm transition-all hover:scale-105 hover:border-neutral-200 hover:bg-neutral-50 hover:shadow-md active:scale-95"
              >
                <span className="text-5xl group-hover:animate-bounce">😐</span>
                <span className="font-medium text-neutral-600">Normal</span>
              </button>

              <button
                onClick={() => handleMoodSelect('great')}
                className="group flex flex-col items-center gap-3 rounded-2xl border border-neutral-100 bg-white p-6 shadow-sm transition-all hover:scale-105 hover:border-green-200 hover:bg-green-50 hover:shadow-md active:scale-95"
              >
                <span className="text-5xl group-hover:animate-bounce">😊</span>
                <span className="font-medium text-neutral-600">Feeling great!</span>
              </button>
            </div>
            
            <Button variant="ghost" className="mt-8 text-neutral-400 hover:text-neutral-600" onClick={() => handleMoodSelect('skipped')}>
              Skip this step
            </Button>
          </div>
        )}

        {step === "success" && (
          <div className="space-y-8 rounded-[2rem] border border-emerald-100 bg-white/80 p-12 text-center shadow-[0_16px_60px_rgb(16,185,129,0.15)] backdrop-blur-2xl animate-in zoom-in-95 duration-500">
            <div className="relative mx-auto h-24 w-24">
              <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-75" />
              <div className="relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-tr from-emerald-400 to-emerald-500 shadow-xl shadow-emerald-500/30">
                <CheckCircle2 className="h-12 w-12 text-white" />
              </div>
            </div>
            
            <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">{t("kiosk.checkedIn", "You're checked in!")}</h1>
            
            <div className="rounded-[1.5rem] border border-primary-100 bg-gradient-to-br from-primary-50/80 to-white py-8 shadow-inner">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-primary-500">{t("kiosk.queueNumber", "Your queue number")}</p>
              <p className="font-mono text-6xl font-black tracking-tighter text-primary-700 drop-shadow-sm">{queueCode}</p>
            </div>
            
            <p className="text-neutral-600 text-lg font-medium leading-relaxed px-4">
              {t("kiosk.waitMessage", "Please take a seat. We will call your number when ready.")}
            </p>
            
            <div className="space-y-1.5 text-xs text-neutral-400 font-semibold border-t border-neutral-100/50 pt-6">
              <p>{t("kiosk.autoResetHint", "This screen will reset automatically for the next patient.")}</p>
            </div>
            
            <button 
              onClick={resetToWelcome}
              className="w-full h-14 text-lg font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition duration-200 active:scale-98"
            >
              {t("kiosk.done", "Done")}
            </button>
          </div>
        )}

        {step === "intakeSuccess" && (
          <div className="space-y-8 rounded-[2rem] border border-emerald-100 bg-white/80 p-12 text-center shadow-[0_16px_60px_rgb(16,185,129,0.15)] backdrop-blur-2xl animate-in zoom-in-95 duration-500">
            <div className="relative mx-auto h-24 w-24">
              <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-75" />
              <div className="relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-tr from-emerald-400 to-emerald-500 shadow-xl shadow-emerald-500/30">
                <CheckCircle2 className="h-12 w-12 text-white" />
              </div>
            </div>

            <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">
              {t("kiosk.intakeSuccess", "Registration submitted!")}
            </h1>

            {intakeId ? (
              <div className="rounded-[1.5rem] border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white py-8 shadow-inner">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
                  {t("kiosk.registrationReference", "Your registration reference")}
                </p>
                <p className="font-mono text-4xl font-black tracking-tighter text-emerald-700 drop-shadow-sm">
                  {intakeId.slice(0, 8).toUpperCase()}
                </p>
              </div>
            ) : null}

            <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-4 py-3 text-emerald-900">
              <MapPin className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
              <p className="text-base font-semibold leading-snug">
                {t("kiosk.proceedToFrontDesk", "Please proceed to the front desk")}
              </p>
            </div>

            <p className="text-neutral-600 text-base font-medium leading-relaxed px-4">
              {t(
                "kiosk.intakeSuccessHint",
                "Please see the front desk to complete your file."
              )}
            </p>

            <button
              onClick={resetToWelcome}
              className="w-full h-14 text-lg font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition duration-200 active:scale-[0.98]"
            >
              {t("kiosk.done", "Done")}
            </button>
          </div>
        )}

        {step === "pending_approval" && (
          <div className="space-y-8 rounded-[2rem] border border-amber-200 bg-white/85 p-10 text-center shadow-[0_16px_50px_rgba(245,158,11,0.15)] backdrop-blur-3xl animate-in zoom-in-95 duration-500">
            <div className="relative mx-auto h-24 w-24">
              <div className="absolute inset-0 rounded-full bg-amber-100 animate-ping opacity-75" />
              <div className="relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 to-amber-500 shadow-xl shadow-amber-500/30">
                <AlertCircle className="h-12 w-12 text-white" />
              </div>
            </div>
            
            <div className="space-y-4">
              <h1 className="text-3xl font-black text-amber-800 tracking-tight">
                {t("kiosk.pendingTitle", "Registration Pending Approval")}
              </h1>
              <p className="text-xl font-bold text-neutral-800 leading-snug px-2">
                Kaydınız Alınmıştır, Banko Onayı Bekleniyor!
              </p>
              <p className="text-neutral-500 text-base leading-relaxed px-4">
                Your online registration has been received but must be approved by the receptionist before you can check in. Please proceed to the front desk.
              </p>
            </div>

            <div className="pt-2">
              <button 
                onClick={resetToWelcome}
                className="w-full h-16 text-xl font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-2xl transition-all active:scale-[0.98]"
              >
                {t("kiosk.done", "Return to Main Page")}
              </button>
            </div>
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
