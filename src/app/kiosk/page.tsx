"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import {
  createKioskSession,
  getKioskMedicalHistoryPreview,
  getKioskQueueStats,
  kioskCheckInSafeError,
  publicChannelSafeError,
  submitKioskCheckin,
  submitKioskIntake,
  submitKioskSatisfaction,
  updateKioskMood,
} from "@/lib/kiosk/kiosk-service"
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
import {
  emptyPublicIntakeFormState,
  publicIntakeToKioskPayload,
  type PublicIntakeFormState,
} from "@/lib/patients/public-intake-form"
import { PublicPatientIntakeFields } from "@/components/patients/PublicPatientIntakeFields"

type Step = "loading" | "welcome" | "form" | "consents" | "mood" | "success" | "error" | "intakeForm" | "intakeSuccess" | "pending_approval" | "update_history_verify" | "update_history_form" | "satisfaction_survey" | "survey_success"

const AUTO_RESET_MS = 8_000
const FORM_IDLE_MS = 120_000
const kioskPanelClass =
  "rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-lg sm:rounded-3xl sm:p-8"

type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: typeof AudioContext
}

function formatPhoneNumber(value: string): string {
  const clean = value.replace(/\D/g, "")
  if (clean.length === 0) return ""
  if (clean.length <= 4) {
    return clean
  }
  if (clean.length <= 7) {
    return `${clean.slice(0, 4)}-${clean.slice(4)}`
  }
  return `${clean.slice(0, 4)}-${clean.slice(4, 7)}-${clean.slice(7, 11)}`
}

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
  const [queueCode, setQueueCode] = React.useState("")
  const [entryId, setEntryId] = React.useState("")
  const [intakeId, setIntakeId] = React.useState("")
  const [updatePatientId, setUpdatePatientId] = React.useState("")
  const [intakeForm, setIntakeForm] = React.useState<PublicIntakeFormState>(emptyPublicIntakeFormState)
  const [submitting, setSubmitting] = React.useState(false)
  const [isScreensaver, setIsScreensaver] = React.useState(false)
  const [liveQueue, setLiveQueue] = React.useState<{ serving: string[]; waitCount: number } | null>(null)
  const [consentSnapshot, setConsentSnapshot] = React.useState<PortalSnapshot | null>(null)
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = React.useState(false)
  const [hasSigned, setHasSigned] = React.useState(false)
  const [consentAccepted, setConsentAccepted] = React.useState(false)
  const [rating, setRating] = React.useState<number>(0)
  const [feedbackText, setFeedbackText] = React.useState("")

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.strokeStyle = "#0f766e"
    ctx.lineWidth = 3
    ctx.lineCap = "round"
    const rect = canvas.getBoundingClientRect()
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasSigned(true)
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSigned(false)
  }

  const resetToWelcome = React.useCallback(() => {
    setStep("welcome")
    setPhone("")
    setLastName("")
    setErrorMsg("")
    setQueueCode("")
    setEntryId("")
    setIntakeId("")
    setUpdatePatientId("")
    setConsentSnapshot(null)
    setIntakeForm(emptyPublicIntakeFormState())
    setHasSigned(false)
    setConsentAccepted(false)
    setRating(0)
    setFeedbackText("")
  }, [])

  const getIntakeProgress = () => {
    let score = 0
    const total = 6
    if (intakeForm.firstName.trim()) score++
    if (intakeForm.lastName.trim()) score++
    if (intakeForm.phone.trim()) score++
    if (intakeForm.email.trim()) score++
    if (consentAccepted) score++
    if (hasSigned) score++
    return Math.round((score / total) * 100)
  }

  React.useEffect(() => {
    if (!token) {
      const id = window.setTimeout(() => {
        setStep("error")
        setErrorMsg(t("kiosk.invalidLink", "Invalid kiosk link. Please ask the front desk for assistance."))
      }, 0)
      return () => window.clearTimeout(id)
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

  // Dynamic Reset Idle Timer that resets on any user interaction (mouse, touch, keypress)
  React.useEffect(() => {
    if (step === "welcome" || step === "error" || step === "loading") return
    
    const timeoutDuration = (step === "success" || step === "intakeSuccess" || step === "pending_approval") 
      ? AUTO_RESET_MS 
      : FORM_IDLE_MS
      
    let timerId = setTimeout(resetToWelcome, timeoutDuration)
    
    const resetTimer = () => {
      clearTimeout(timerId)
      timerId = setTimeout(resetToWelcome, timeoutDuration)
    }

    // Add listeners for active actions
    window.addEventListener("mousemove", resetTimer)
    window.addEventListener("keypress", resetTimer)
    window.addEventListener("touchstart", resetTimer)
    window.addEventListener("scroll", resetTimer)

    return () => {
      clearTimeout(timerId)
      window.removeEventListener("mousemove", resetTimer)
      window.removeEventListener("keypress", resetTimer)
      window.removeEventListener("touchstart", resetTimer)
      window.removeEventListener("scroll", resetTimer)
    }
  }, [step, phone, lastName, intakeForm, resetToWelcome])

  // Idle timer for screensaver
  React.useEffect(() => {
    if (step !== "welcome") return
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
      const AudioContextCtor = window.AudioContext || (window as WindowWithWebkitAudio).webkitAudioContext
      if (AudioContextCtor) {
        const ctx = new AudioContextCtor()
        // Play double chime: C5 then E5
        const playTone = (freq: number, start: number, duration: number) => {
          const osc = ctx.createOscillator()
          const gainNode = ctx.createGain()
          osc.type = "sine"
          osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
          gainNode.gain.setValueAtTime(0, ctx.currentTime + start)
          gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + start + 0.05)
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + duration)
          osc.connect(gainNode)
          gainNode.connect(ctx.destination)
          osc.start(ctx.currentTime + start)
          osc.stop(ctx.currentTime + start + duration)
        }
        playTone(523.25, 0, 0.3) // C5
        playTone(659.25, 0.15, 0.4) // E5
      }

      if (speechText && "speechSynthesis" in window) {
        setTimeout(() => {
          window.speechSynthesis.cancel()
          const utterance = new SpeechSynthesisUtterance(speechText)
          
          // Try to select a natural voice
          const voices = window.speechSynthesis.getVoices()
          const trVoice = voices.find(v => v.lang.startsWith("tr"))
          const enVoice = voices.find(v => v.lang.startsWith("en"))
          
          if (/[a-zA-Z]/.test(speechText) && !/Kaydınız|Sıra/i.test(speechText)) {
            utterance.lang = "en-US"
            if (enVoice) utterance.voice = enVoice
          } else {
            utterance.lang = "tr-TR"
            if (trVoice) utterance.voice = trVoice
          }
          
          utterance.rate = 0.9
          utterance.pitch = 1.05
          window.speechSynthesis.speak(utterance)
        }, 400)
      }
    } catch {
      // Ignore
    }
  }

  const playPendingSound = React.useCallback((speechText: string) => {
    try {
      const AudioContextCtor = window.AudioContext || (window as WindowWithWebkitAudio).webkitAudioContext
      if (AudioContextCtor) {
        const ctx = new AudioContextCtor()
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
          setErrorMsg(
            kioskCheckInSafeError(
              error,
              t("kiosk.checkInFailed", "Check-in failed. Please see the front desk.")
            )
          )
        }
      } else {
        setErrorMsg(
          kioskCheckInSafeError(
            error,
            t("kiosk.checkInFailed", "Check-in failed. Please see the front desk.")
          )
        )
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
      setErrorMsg(
        kioskCheckInSafeError(
          error,
          t("kiosk.checkInFailed", "Check-in failed. Please see the front desk.")
        )
      )
      return
    }

    if (hasPendingKioskConsents(snapshot)) {
      setConsentSnapshot(snapshot)
      setStep("consents")
      return
    }

    await performCheckIn()
  }

  const finishCheckInSuccess = () => {
    setStep("success")
    const spelledCode = queueCode.split("").join(" ")
    const announcementText = `Sayın ${lastName}, girişiniz yapıldı. Sıra numaranız: ${spelledCode}. Lütfen bekleme alanına geçiniz.`
    playSuccessSound(announcementText)
  }

  const handleMoodSelect = async (mood: string) => {
    if (entryId) {
      await updateKioskMood(entryId, mood)
    }
    setStep("satisfaction_survey")
  }

  const handleSatisfactionSubmit = async () => {
    if (rating < 1 || rating > 5) {
      setErrorMsg(t("kiosk.ratingRequired", "Please choose a star rating before continuing."))
      return
    }
    setSubmitting(true)
    setErrorMsg("")
    const { error } = await submitKioskSatisfaction(sessionId, entryId || null, rating, feedbackText)
    setSubmitting(false)
    if (error) {
      setErrorMsg(
        publicChannelSafeError(
          error,
          t("kiosk.feedbackFailed", "We could not save your feedback. Please see the front desk.")
        )
      )
      return
    }
    setStep("survey_success")
    window.setTimeout(() => finishCheckInSuccess(), 1200)
  }

  const handleSatisfactionSkip = () => {
    setErrorMsg("")
    finishCheckInSuccess()
  }

  const handleIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg("")
    const { data, error } = await submitKioskIntake(
      sessionId,
      publicIntakeToKioskPayload(intakeForm)
    )
    setSubmitting(false)
    if (error) {
      setErrorMsg(
        publicChannelSafeError(
          error,
          t("kiosk.registrationFailed", "Registration could not be submitted. Please see the front desk.")
        )
      )
      return
    }
    if (data?.intake_id) {
      setIntakeId(data.intake_id)
    }
    setStep("intakeSuccess")
    playSuccessSound(t("kiosk.speechIntake", "Registration received. Please wait for the front desk."))
  }

  const handleUpdateHistoryVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg("")

    const { data, error } = await getKioskMedicalHistoryPreview(sessionId, phone, lastName)
    setSubmitting(false)

    if (error || !data) {
      setErrorMsg(
        publicChannelSafeError(
          error,
          t(
            "kiosk.patientNotFound",
            "No patient record found matching those details. Please check and try again."
          )
        )
      )
      return
    }

    setUpdatePatientId(data.patient_id)
    setIntakeForm({
      ...emptyPublicIntakeFormState(),
      firstName: data.first_name,
      lastName: data.last_name,
      phone: data.phone ?? phone,
      medicalAlerts: data.medical_alerts,
    })
    setStep("update_history_form")
  }

  const handleUpdateHistorySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg("")

    const payload = {
      ...publicIntakeToKioskPayload(intakeForm),
      patient_id: updatePatientId,
      source: "kiosk_update",
    }

    const { data, error } = await submitKioskIntake(sessionId, payload)
    setSubmitting(false)

    if (error) {
      setErrorMsg(
        publicChannelSafeError(
          error,
          t("kiosk.updateFailed", "Failed to submit medical history update. Please see the front desk.")
        )
      )
      return
    }

    if (data?.intake_id) {
      setIntakeId(data.intake_id)
    }
    setStep("intakeSuccess")
    playSuccessSound(t("kiosk.speechIntake", "Update received. Please wait for the front desk to verify."))
  }

  const showSteps = step !== "loading" && step !== "error"
  const flowStep = kioskStepFromFlow(step)

  if (step === "welcome" && isScreensaver) {
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
    <div className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-primary-50 via-white to-primary-100 px-4 py-6 font-sans text-neutral-900 antialiased selection:bg-primary-100 selection:text-primary-900 sm:p-6">
      {/* Dynamic Background Elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-[10%] -top-[10%] h-[40%] w-[40%] rounded-full bg-primary-300/30 blur-[100px] sm:blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] h-[40%] w-[40%] rounded-full bg-primary-400/20 blur-[100px] sm:blur-[120px]" />
      </div>

      {/* Live Queue Widget */}
      {step === "welcome" && liveQueue && (
        <div className="absolute top-6 right-6 z-40 animate-fade-in flex flex-col items-end gap-2">
          <div className="flex items-center gap-3 rounded-full border border-white/60 bg-white/40 p-2 pr-4 shadow-sm backdrop-blur-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500 text-white shadow-inner">
              <Users className="h-5 w-5" />
            </div>
            <div className="flex flex-col text-sm">
              <span className="font-medium text-neutral-800 leading-tight">
                {t("kiosk.currentlyServing", "Currently Serving")}: {liveQueue.serving.length > 0 ? liveQueue.serving.join(", ") : t("common.none", "None")}
              </span>
              <span className="text-xs text-neutral-500 font-medium">
                {t("kiosk.waitCount", "{count} waiting").replace("{count}", String(liveQueue.waitCount))}
              </span>
            </div>
          </div>
          {liveQueue.waitCount > 0 && (
            <div className="rounded-lg border border-teal-100 bg-teal-50/70 px-3 py-1 text-[11px] font-semibold text-teal-800 backdrop-blur-md shadow-sm flex items-center gap-1.5 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
              {t("kiosk.estWaitTime", "Est. Wait Time: ~{time} mins").replace("{time}", String(liveQueue.waitCount * 15))}
            </div>
          )}
        </div>
      )}

      <PublicChannelBrand variant="header" />

      <div className="relative z-10 w-full max-w-md touch-manipulation transition-all duration-500 ease-out">
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
              <button
                onClick={() => setStep("update_history_verify")}
                className="w-full h-14 text-lg font-bold text-neutral-600 bg-white/80 border-2 border-transparent hover:border-primary-100 hover:bg-white rounded-xl shadow-sm transition-all duration-200 active:scale-[0.98]"
              >
                {t("kiosk.updateHistory", "Update medical history")}
              </button>
            </div>
          </div>
        )}

        {step === "form" && (
          <div className={`${kioskPanelClass} animate-in slide-in-from-bottom-4 duration-500`}>
            <div className="mb-6 text-center sm:mb-8">
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
                {t("kiosk.checkInTitle", "Check in")}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600 sm:text-base">
                {t("kiosk.checkInHint", "Enter the phone number and last name on your record.")}
              </p>
            </div>
            <form onSubmit={handleCheckIn} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="kiosk-phone" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {t("kiosk.mobileNumber", "Mobile number")}
                </label>
                <Input
                  id="kiosk-phone"
                  type="tel"
                  inputMode="tel"
                  required
                  placeholder="09XX XXX XXXX"
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                  autoComplete="tel"
                  autoFocus
                  className="h-12 text-lg sm:h-14 sm:text-xl"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="kiosk-last-name" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {t("kiosk.lastName", "Last name")}
                </label>
                <Input
                  id="kiosk-last-name"
                  required
                  placeholder="Aquino"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  className="h-12 text-lg sm:h-14 sm:text-xl"
                />
              </div>
              {errorMsg ? (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-snug text-red-700"
                >
                  {errorMsg}
                </div>
              ) : null}
              <div className="space-y-3 pt-1">
                <Button type="submit" disabled={submitting} size="lg" className="h-12 w-full text-base sm:h-14 sm:text-lg">
                  {submitting
                    ? t("kiosk.checkingIn", "Checking in…")
                    : t("kiosk.confirmCheckIn", "Confirm check-in")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={resetToWelcome}
                  className="h-11 w-full text-neutral-600"
                >
                  {t("kiosk.back", "Back")}
                </Button>
              </div>
            </form>
          </div>
        )}

        {step === "update_history_verify" && (
          <div className={`${kioskPanelClass} animate-in slide-in-from-bottom-4 duration-500`}>
            <div className="mb-6 text-center sm:mb-8">
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
                Update Medical History
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600 sm:text-base">
                Enter your mobile number and last name to verify your identity.
              </p>
            </div>
            <form onSubmit={handleUpdateHistoryVerify} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="kiosk-verify-phone" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Mobile number
                </label>
                <Input
                  id="kiosk-verify-phone"
                  type="tel"
                  inputMode="tel"
                  required
                  placeholder="09XX XXX XXXX"
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                  autoComplete="tel"
                  autoFocus
                  className="h-12 text-lg sm:h-14 sm:text-xl"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="kiosk-verify-last-name" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Last name
                </label>
                <Input
                  id="kiosk-verify-last-name"
                  required
                  placeholder="Aquino"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  className="h-12 text-lg sm:h-14 sm:text-xl"
                />
              </div>
              {errorMsg ? (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-snug text-red-700">
                  {errorMsg}
                </div>
              ) : null}
              <div className="space-y-3 pt-1">
                <Button type="submit" disabled={submitting} size="lg" className="h-12 w-full text-base sm:h-14 sm:text-lg">
                  {submitting ? "Verifying…" : "Next"}
                </Button>
                <Button type="button" variant="ghost" onClick={resetToWelcome} className="h-11 w-full text-neutral-600">
                  Back
                </Button>
              </div>
            </form>
          </div>
        )}

        {step === "update_history_form" && (
          <div className="rounded-[2rem] border border-white bg-white/70 p-10 shadow-[0_8px_40px_rgb(0,0,0,0.08)] backdrop-blur-2xl animate-in slide-in-from-bottom-4 duration-500">
            <div className="mb-8 text-center">
              <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">Update Medical History</h1>
              <p className="text-base text-neutral-500 mt-2">
                Please review and update your medical conditions, allergies, or medications.
              </p>
            </div>
            <form onSubmit={handleUpdateHistorySubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700">
                  Medical Alerts, Allergies, or Conditions
                </label>
                <textarea
                  className="w-full min-h-[160px] rounded-xl border border-neutral-300 p-3 text-sm bg-white"
                  placeholder="e.g. Penicillin allergy, Hypertension, Asthma"
                  value={intakeForm.medicalAlerts}
                  onChange={(e) => setIntakeForm({ ...intakeForm, medicalAlerts: e.target.value })}
                />
              </div>
              {errorMsg ? (
                <div className="rounded-2xl bg-red-50/80 border border-red-100 p-4 text-center text-sm font-semibold text-red-600 animate-in fade-in">
                  {errorMsg}
                </div>
              ) : null}
              <div className="pt-2 space-y-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="group relative w-full h-16 text-xl font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-2xl shadow-lg shadow-primary-500/30 transition-all duration-300 active:scale-[0.98] overflow-hidden"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-[-100%] group-hover:translate-y-[100%] transition-transform duration-700 ease-in-out" />
                  {submitting ? "Submitting…" : "Submit Update"}
                </button>
                <button
                  type="button"
                  onClick={() => setStep("update_history_verify")}
                  className="w-full h-12 text-base font-bold text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100/50 rounded-xl transition-all"
                >
                  Back
                </button>
              </div>
            </form>
          </div>
        )}

        {step === "intakeForm" && (
          <div className="rounded-[2rem] border border-white bg-white/70 p-10 shadow-[0_8px_40px_rgb(0,0,0,0.08)] backdrop-blur-2xl animate-in slide-in-from-bottom-4 duration-500">
            {/* Dynamic Progress Bar */}
            <div className="mb-6 w-full bg-neutral-200 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-primary-600 h-1.5 rounded-full transition-all duration-500 ease-out" 
                style={{ width: `${getIntakeProgress()}%` }}
              />
              <div className="flex justify-between items-center mt-2 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                <span>{t("kiosk.progressLabel", "Registration Progress")}</span>
                <span>{t("kiosk.progressComplete", "{n}% Complete").replace("{n}", String(getIntakeProgress()))}</span>
              </div>
            </div>

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
              <PublicPatientIntakeFields value={intakeForm} onChange={setIntakeForm} />
              
              {/* KVKK / Privacy Consent & Signature Board */}
              <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-4 space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-neutral-600 select-none">
                  <input
                    type="checkbox"
                    checked={consentAccepted}
                    onChange={(e) => setConsentAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span>
                    {t("kiosk.consentText", "I confirm that the medical history information provided is accurate, and I consent to the collection and processing of my personal and health data in compliance with clinical safety laws.")}
                  </span>
                </label>

                {consentAccepted && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                        {t("kiosk.drawSignature", "Draw your signature below:")}
                      </span>
                      {hasSigned && (
                        <button
                          type="button"
                          onClick={clearCanvas}
                          className="text-[10px] text-red-500 hover:text-red-700 font-bold"
                        >
                          {t("common.clear", "Clear")}
                        </button>
                      )}
                    </div>
                    <div className="relative border border-neutral-300 bg-white rounded-lg overflow-hidden h-32 w-full">
                      <canvas
                        ref={canvasRef}
                        width={400}
                        height={128}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
                      />
                    </div>
                  </div>
                )}
              </div>

              {errorMsg ? (
                <div className="rounded-2xl bg-red-50/80 border border-red-100 p-4 text-center text-sm font-semibold text-red-600 animate-in fade-in slide-in-from-top-2">
                  {errorMsg}
                </div>
              ) : null}
              <div className="pt-2 space-y-4">
                <button 
                  type="submit" 
                  disabled={submitting || !consentAccepted || !hasSigned}
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

        {step === "satisfaction_survey" && (
          <div className="rounded-[2rem] border border-white bg-white/70 p-10 text-center shadow-[0_8px_40px_rgb(0,0,0,0.08)] backdrop-blur-2xl animate-in slide-in-from-bottom-8 fade-in duration-500">
            <h2 className="mb-2 text-3xl font-semibold tracking-tight text-neutral-900">
              {t("kiosk.surveyTitle", "How was check-in today?")}
            </h2>
            <p className="mb-8 text-neutral-500">
              {t("kiosk.surveyHint", "Optional — your feedback helps our front desk improve.")}
            </p>

            <div className="mb-6 flex justify-center gap-2" role="group" aria-label={t("kiosk.surveyRating", "Star rating")}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => {
                    setRating(star)
                    setErrorMsg("")
                  }}
                  className={[
                    "flex h-14 w-14 items-center justify-center rounded-2xl border text-2xl transition active:scale-95",
                    rating >= star
                      ? "border-amber-300 bg-amber-50 text-amber-500"
                      : "border-neutral-200 bg-white text-neutral-300 hover:border-amber-200 hover:text-amber-400",
                  ].join(" ")}
                  aria-pressed={rating >= star}
                  aria-label={`${star}`}
                >
                  ★
                </button>
              ))}
            </div>

            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value.slice(0, 500))}
              rows={3}
              maxLength={500}
              placeholder={t("kiosk.surveyCommentPlaceholder", "Anything we should know? (optional)")}
              className="mb-4 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left text-sm text-neutral-800 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
            />

            {errorMsg ? (
              <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMsg}
              </div>
            ) : null}

            <div className="space-y-3">
              <Button
                type="button"
                size="lg"
                className="h-14 w-full text-lg"
                disabled={submitting}
                onClick={() => void handleSatisfactionSubmit()}
              >
                {submitting
                  ? t("common.saving", "Saving…")
                  : t("kiosk.surveySubmit", "Send feedback")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-12 w-full text-neutral-500"
                disabled={submitting}
                onClick={handleSatisfactionSkip}
              >
                {t("kiosk.surveySkip", "Skip")}
              </Button>
            </div>
          </div>
        )}

        {step === "survey_success" && (
          <div className="rounded-[2rem] border border-emerald-100 bg-white/80 p-12 text-center shadow-[0_16px_60px_rgb(16,185,129,0.12)] backdrop-blur-2xl animate-in zoom-in-95 duration-500">
            <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-emerald-500" />
            <h2 className="text-2xl font-bold text-neutral-900">
              {t("kiosk.surveyThanks", "Thank you!")}
            </h2>
            <p className="mt-2 text-neutral-500">
              {t("kiosk.surveyThanksHint", "Getting your queue number ready…")}
            </p>
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
