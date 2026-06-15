"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { createKioskSession, submitPortalAppointment, verifyPortalPatient, submitKioskIntake } from "@/lib/kiosk/kiosk-service"
import { fetchBranchProviderAvailability } from "@/lib/appointments/provider-availability-service"
import { fetchAvailableAppointmentSlots } from "@/lib/appointments/provider-availability-service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useLocale } from "@/hooks/use-locale"
import { PORTAL_VISIT_REASONS, type PortalVisitReasonId } from "@/lib/portal/visit-reasons"
import { 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  UserCheck, 
  UserPlus, 
  ArrowLeft,
  Phone,
  Mail,
  CalendarDays,
  MapPin,
  ShieldAlert,
  HeartHandshake
} from "lucide-react"

type Step = 
  | "loading" 
  | "welcome" 
  | "identity" 
  | "provider" 
  | "datetime" 
  | "intakeForm"
  | "intakeSuccess"
  | "success" 
  | "error"
  | "pending_approval"

export default function PortalPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-100">
          <Loader2 className="h-10 w-10 animate-spin text-primary-500" />
        </div>
      }
    >
      <PortalPageContent />
    </React.Suspense>
  )
}

function PortalPageContent() {
  const searchParams = useSearchParams()
  const { t } = useLocale()
  const token = searchParams?.get("token")

  const [step, setStep] = React.useState<Step>("loading")
  const [sessionId, setSessionId] = React.useState("")
  const [branchId, setBranchId] = React.useState("")
  const [branchName, setBranchName] = React.useState("")
  const [errorMsg, setErrorMsg] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  // Registered Patient Form State
  const [phone, setPhone] = React.useState("")
  const [lastName, setLastName] = React.useState("")
  const [selectedProvider, setSelectedProvider] = React.useState("")
  const [selectedDate, setSelectedDate] = React.useState("")
  const [selectedTime, setSelectedTime] = React.useState("")
  const [bookingReason, setBookingReason] = React.useState<PortalVisitReasonId>("general_checkup")
  const [customReason, setCustomReason] = React.useState("")

  // New Patient Registration Form State
  const [newFirstName, setNewFirstName] = React.useState("")
  const [newLastName, setNewLastName] = React.useState("")
  const [newPhone, setNewPhone] = React.useState("")
  const [newEmail, setNewEmail] = React.useState("")
  const [newDob, setNewDob] = React.useState("")
  const [newGender, setNewGender] = React.useState("other")
  const [newAddress, setNewAddress] = React.useState("")
  const [newCity, setNewCity] = React.useState("")
  const [newEmergencyName, setNewEmergencyName] = React.useState("")
  const [newEmergencyPhone, setNewEmergencyPhone] = React.useState("")
  const [newMedicalAlerts, setNewMedicalAlerts] = React.useState("")

  // Data
  const [providers, setProviders] = React.useState<{ id: string; name: string }[]>([])
  const [slots, setSlots] = React.useState<{ time: string; available: boolean }[]>([])

  React.useEffect(() => {
    if (!token) {
      setErrorMsg("Portal connection token is missing.")
      setStep("error")
      return
    }

    createKioskSession(token).then(({ data, error }) => {
      if (error || !data) {
        setErrorMsg(error ?? "Connection is invalid or has expired.")
        setStep("error")
        return
      }
      setSessionId(data.session_id)
      setBranchId(data.branch_id)
      setBranchName(data.branch_name)
      setStep("welcome")
    })
  }, [token])

  const handleIdentitySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone || !lastName) return

    setSubmitting(true)
    setErrorMsg("")

    const { error: verifyError } = await verifyPortalPatient(sessionId, phone, lastName)
    if (verifyError) {
      setSubmitting(false)
      if (verifyError.includes("REGISTRATION_PENDING")) {
        setStep("pending_approval")
        playPendingSound(
          "Your registration has been received but is pending approval at the front desk. Kaydınız alınmıştır ancak henüz banko tarafından onaylanmamıştır."
        )
      } else {
        setErrorMsg("No record found. Please check your information or create a New Patient Registration.")
      }
      return
    }

    const { data } = await fetchBranchProviderAvailability(branchId)
    setSubmitting(false)
    const uniqueProviders = Array.from(new Map(data.map(p => [p.provider_id, p])).values())
    setProviders(uniqueProviders.map(p => ({ id: p.provider_id, name: p.provider_name })))
    setStep("provider")
  }

  const playPendingSound = (speechText: string) => {
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
    } catch (e) {
      // Ignore
    }
  }

  const handleNewPatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFirstName || !newLastName || !newPhone) {
      setErrorMsg("First name, last name, and phone number are required.")
      return
    }

    setSubmitting(true)
    setErrorMsg("")

    const { error } = await submitKioskIntake(sessionId, {
      first_name: newFirstName,
      last_name: newLastName,
      phone: newPhone,
      email: newEmail || undefined,
      date_of_birth: newDob || undefined,
      gender: newGender,
      address_line1: newAddress || undefined,
      city: newCity || undefined,
      emergency_contact_name: newEmergencyName || undefined,
      emergency_contact_phone: newEmergencyPhone || undefined,
      medical_alerts: newMedicalAlerts || undefined
    })

    setSubmitting(false)

    if (error) {
      setErrorMsg(error ?? "An error occurred while creating the registration.")
    } else {
      setStep("intakeSuccess")
    }
  }

  const handleProviderSelect = (provId: string) => {
    setSelectedProvider(provId)
    // Default to tomorrow
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr = tomorrow.toISOString().split("T")[0]
    handleDateSelect(dateStr, provId)
    setStep("datetime")
  }

  const handleDateSelect = (date: string, provId = selectedProvider) => {
    setSelectedDate(date)
    fetchAvailableAppointmentSlots({ branchId, providerId: provId, date }).then(({ data }) => {
      setSlots(data || [])
      setSelectedTime("")
    })
  }

  const handleBook = async () => {
    if (!selectedTime) return
    setSubmitting(true)
    setErrorMsg("")
    const reasonEntry = PORTAL_VISIT_REASONS.find((r) => r.id === bookingReason)
    const finalPurpose =
      bookingReason === "other"
        ? customReason.trim() || t("portal.reasonOther", "Other")
        : t(reasonEntry?.labelKey ?? "portal.reasonGeneral", reasonEntry?.labelFallback ?? "General checkup")
    const { data, error } = await submitPortalAppointment({
      sessionId,
      phone,
      lastName,
      providerId: selectedProvider,
      date: selectedDate,
      time: selectedTime,
      purpose: finalPurpose
    })
    setSubmitting(false)

    if (error || !data) {
      setErrorMsg(error ?? "An error occurred while booking the appointment.")
    } else {
      setStep("success")
    }
  }

  // Next 7 days
  const upcomingDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i + 1)
    return d.toISOString().split("T")[0]
  })

  // Stepper helper
  const renderStepper = () => {
    if (step === "loading" || step === "error") return null;

    const steps = step === "intakeForm" || step === "intakeSuccess"
      ? [
          { key: "welcome", label: "Start" },
          { key: "intakeForm", label: "Register" },
          { key: "intakeSuccess", label: "Done" }
        ]
      : [
          { key: "welcome", label: "Start" },
          { key: "identity", label: "Verify" },
          { key: "provider", label: "Doctor" },
          { key: "datetime", label: "Time" },
          { key: "success", label: "Done" }
        ]

    const getActiveIdx = () => {
      if (step === "welcome") return 0;
      if (step === "intakeForm" || step === "identity") return 1;
      if (step === "intakeSuccess" || step === "provider") return 2;
      if (step === "datetime") return 3;
      if (step === "success") return 4;
      return 0;
    }

    const activeIdx = getActiveIdx();

    return (
      <div className="mb-8 flex items-center justify-between w-full px-2 select-none">
        {steps.map((s, idx) => (
          <React.Fragment key={s.key}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                  idx <= activeIdx 
                    ? "bg-primary-600 text-white shadow-[0_0_12px_rgba(13,148,136,0.3)] ring-2 ring-primary-500/20" 
                    : "bg-neutral-100 text-neutral-400 border border-neutral-200"
                }`}
              >
                {idx + 1}
              </div>
              <span className={`text-[10px] font-semibold tracking-wide uppercase transition-colors duration-300 ${
                idx === activeIdx ? "text-primary-600 font-bold" : idx < activeIdx ? "text-neutral-500" : "text-neutral-400"
              }`}>
                {s.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-2 -mt-5 rounded-full transition-all duration-500 ${
                  idx < activeIdx ? "bg-primary-500" : "bg-neutral-100 border-t border-neutral-200"
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    )
  }

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-primary-50 via-white to-primary-100 p-4 sm:p-6 font-sans text-neutral-900 antialiased selection:bg-primary-100 selection:text-primary-900">
      {/* Background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-[10%] -top-[10%] h-[50%] w-[50%] rounded-full bg-primary-200/30 blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] h-[50%] w-[50%] rounded-full bg-primary-300/20 blur-[120px]" />
      </div>

      <p className="absolute left-0 right-0 top-6 text-center text-sm font-bold tracking-widest text-neutral-400 select-none uppercase">
        dentali<span className="text-primary-600">.</span> portal
      </p>

      <div className="relative z-10 w-full max-w-[440px] my-12">
        {renderStepper()}

        {step === "loading" && (
          <div className="flex flex-col items-center justify-center space-y-4 py-20 text-neutral-400">
            <Loader2 className="h-10 w-10 animate-spin text-primary-500" />
            <p className="text-sm font-medium tracking-wide">Connecting...</p>
          </div>
        )}

        {step === "error" && (
          <div className="rounded-3xl border border-red-100 bg-white/80 p-8 text-center shadow-xl backdrop-blur-xl animate-in slide-in-from-bottom-6 duration-300">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-neutral-900 mb-2">Error</h2>
            <p className="text-neutral-500">{errorMsg}</p>
          </div>
        )}

        {step === "welcome" && (
          <div className="rounded-[2.5rem] border border-white bg-white/70 p-6 sm:p-8 shadow-[0_8px_40px_rgb(0,0,0,0.08)] backdrop-blur-2xl animate-in slide-in-from-bottom-8 fade-in duration-500">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 inline-flex items-center rounded-full border border-primary-200/50 bg-primary-50/50 px-4 py-1.5 text-xs font-bold tracking-wider text-primary-700 uppercase">
                ONLINE APPOINTMENT SYSTEM
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl bg-clip-text text-transparent bg-gradient-to-r from-neutral-900 to-neutral-700">
                {branchName}
              </h1>
              <p className="mt-2 text-neutral-500 font-medium">Please choose your status to continue.</p>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => setStep("identity")}
                className="flex w-full items-center gap-4 rounded-2xl border border-neutral-100/80 bg-white p-5 shadow-sm transition-all duration-300 hover:border-primary-200 hover:bg-primary-50/30 hover:shadow-md hover:shadow-primary-500/5 group text-left cursor-pointer active:scale-[0.99]"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 border border-primary-100 text-primary-600 transition-colors group-hover:bg-primary-100">
                  <UserCheck className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-800">I am a Registered Patient</h3>
                  <p className="text-xs text-neutral-500 mt-0.5">If you have visited our clinic before, book your appointment quickly.</p>
                </div>
                <ChevronRight className="ml-auto h-5 w-5 text-neutral-400 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => setStep("intakeForm")}
                className="flex w-full items-center gap-4 rounded-2xl border border-neutral-100/80 bg-white p-5 shadow-sm transition-all duration-300 hover:border-primary-200 hover:bg-primary-50/30 hover:shadow-md hover:shadow-primary-500/5 group text-left cursor-pointer active:scale-[0.99]"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 border border-teal-100 text-teal-600 transition-colors group-hover:bg-teal-100">
                  <UserPlus className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-800">I am a New Patient</h3>
                  <p className="text-xs text-neutral-500 mt-0.5">Create an online registration if this is your first appointment at our clinic.</p>
                </div>
                <ChevronRight className="ml-auto h-5 w-5 text-neutral-400 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        )}

        {step === "identity" && (
          <div className="rounded-[2.5rem] border border-white bg-white/70 p-6 sm:p-8 shadow-[0_8px_40px_rgb(0,0,0,0.08)] backdrop-blur-2xl animate-in slide-in-from-bottom-8 fade-in duration-500">
            <button 
              onClick={() => setStep("welcome")}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-500 hover:text-neutral-800 mb-6 transition-colors uppercase tracking-wider"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Go Back
            </button>

            <div className="mb-6">
              <h2 className="text-2xl font-extrabold text-neutral-900 tracking-tight">Identity Verification</h2>
              <p className="text-sm text-neutral-500 mt-1">Enter your registered information to continue.</p>
            </div>

            <form onSubmit={handleIdentitySubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="pl-1 text-xs font-bold uppercase tracking-widest text-neutral-500">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
                  <Input
                    type="tel"
                    placeholder="09XXXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-14 rounded-2xl border-2 border-transparent bg-white/80 pl-12 pr-5 text-lg shadow-sm transition-all focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 placeholder:text-neutral-300 outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="pl-1 text-xs font-bold uppercase tracking-widest text-neutral-500">
                  Last Name
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
                  <Input
                    type="text"
                    placeholder="Enter your last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="h-14 rounded-2xl border-2 border-transparent bg-white/80 pl-12 pr-5 text-lg shadow-sm transition-all focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 placeholder:text-neutral-300 outline-none"
                    required
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 flex gap-2 text-sm text-red-900 shadow-sm animate-in fade-in slide-in-from-top-2">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="font-medium">{errorMsg}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting}
                className="group mt-2 h-14 w-full rounded-2xl bg-primary-600 text-lg font-bold text-white shadow-lg shadow-primary-500/20 transition-all duration-300 hover:bg-primary-700 hover:shadow-xl active:scale-[0.98]"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>Continue <ChevronRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" /></>
                )}
              </Button>

              <button 
                type="button" 
                onClick={() => setStep("welcome")}
                className="w-full h-12 text-sm font-bold text-neutral-500 hover:text-neutral-850 hover:bg-neutral-100/50 rounded-2xl transition-all active:scale-[0.98]"
              >
                Cancel & Go Back
              </button>
            </form>
          </div>
        )}

        {step === "intakeForm" && (
          <div className="rounded-[2.5rem] border border-white bg-white/70 p-6 sm:p-8 shadow-[0_8px_40px_rgb(0,0,0,0.08)] backdrop-blur-2xl animate-in slide-in-from-bottom-8 fade-in duration-500">
            <button 
              onClick={() => setStep("welcome")}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-500 hover:text-neutral-800 mb-6 transition-colors uppercase tracking-wider"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Go Back
            </button>

            <div className="mb-6">
              <h2 className="text-2xl font-extrabold text-neutral-900 tracking-tight">New Patient Registration</h2>
              <p className="text-sm text-neutral-500 mt-1">Please fill out the form below completely.</p>
            </div>

            <form onSubmit={handleNewPatientSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="pl-1 text-xs font-bold uppercase tracking-wider text-neutral-500">First Name</label>
                  <Input
                    type="text"
                    placeholder="First name"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    className="h-12 rounded-xl border-2 border-transparent bg-white/80 px-4 shadow-sm focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 placeholder:text-neutral-300 outline-none"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="pl-1 text-xs font-bold uppercase tracking-wider text-neutral-500">Last Name</label>
                  <Input
                    type="text"
                    placeholder="Last name"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    className="h-12 rounded-xl border-2 border-transparent bg-white/80 px-4 shadow-sm focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 placeholder:text-neutral-300 outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="pl-1 text-xs font-bold uppercase tracking-wider text-neutral-500">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <Input
                    type="tel"
                    placeholder="Phone number"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="h-12 rounded-xl border-2 border-transparent bg-white/80 pl-10 pr-4 shadow-sm focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 placeholder:text-neutral-300 outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="pl-1 text-xs font-bold uppercase tracking-wider text-neutral-500">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="h-12 rounded-xl border-2 border-transparent bg-white/80 pl-10 pr-4 shadow-sm focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 placeholder:text-neutral-300 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="pl-1 text-xs font-bold uppercase tracking-wider text-neutral-500">Date of Birth</label>
                  <div className="relative">
                    <CalendarDays className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <Input
                      type="date"
                      value={newDob}
                      onChange={(e) => setNewDob(e.target.value)}
                      className="h-12 rounded-xl border-2 border-transparent bg-white/80 pl-10 pr-4 shadow-sm text-sm focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 text-neutral-700 outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="pl-1 text-xs font-bold uppercase tracking-wider text-neutral-500">Gender</label>
                  <select
                    value={newGender}
                    onChange={(e) => setNewGender(e.target.value)}
                    className="h-12 w-full rounded-xl border-2 border-transparent bg-white/80 px-3 shadow-sm text-sm outline-none focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 text-neutral-700"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other / Prefer not to say</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="pl-1 text-xs font-bold uppercase tracking-wider text-neutral-500">Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <Input
                      type="text"
                      placeholder="Street, Block"
                      value={newAddress}
                      onChange={(e) => setNewAddress(e.target.value)}
                      className="h-12 rounded-xl border-2 border-transparent bg-white/80 pl-10 pr-4 shadow-sm focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 placeholder:text-neutral-300 outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="pl-1 text-xs font-bold uppercase tracking-wider text-neutral-500">City</label>
                  <Input
                    type="text"
                    placeholder="City"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    className="h-12 rounded-xl border-2 border-transparent bg-white/80 px-4 shadow-sm focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 placeholder:text-neutral-300 outline-none"
                  />
                </div>
              </div>

              <div className="border-t border-neutral-100 pt-4 mt-2">
                <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3">Emergency Contact Info</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="pl-1 text-xs font-bold uppercase tracking-wider text-neutral-500">Contact Name</label>
                    <Input
                      type="text"
                      placeholder="Contact Name"
                      value={newEmergencyName}
                      onChange={(e) => setNewEmergencyName(e.target.value)}
                      className="h-12 rounded-xl border-2 border-transparent bg-white/80 px-4 shadow-sm focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 placeholder:text-neutral-300 outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="pl-1 text-xs font-bold uppercase tracking-wider text-neutral-500">Phone Number</label>
                    <Input
                      type="tel"
                      placeholder="Phone Number"
                      value={newEmergencyPhone}
                      onChange={(e) => setNewEmergencyPhone(e.target.value)}
                      className="h-12 rounded-xl border-2 border-transparent bg-white/80 px-4 shadow-sm focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 placeholder:text-neutral-300 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 border-t border-neutral-100 pt-4">
                <label className="pl-1 text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1">
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-500" /> Medical History / Allergies
                </label>
                <textarea
                  placeholder="Any chronic diseases, medications, or allergies..."
                  value={newMedicalAlerts}
                  onChange={(e) => setNewMedicalAlerts(e.target.value)}
                  className="w-full min-h-[80px] rounded-xl border-2 border-transparent bg-white/80 p-3 text-sm shadow-sm outline-none focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 text-neutral-700"
                />
              </div>

              {errorMsg && (
                <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 flex gap-2 text-sm text-red-900 shadow-sm">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <p>{errorMsg}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting}
                className="group h-12 w-full rounded-xl bg-primary-600 font-bold text-white shadow-lg shadow-primary-500/20 transition-all hover:bg-primary-700 hover:shadow-xl active:scale-[0.98]"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>Submit Registration Request <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" /></>
                )}
              </Button>

              <button 
                type="button" 
                onClick={() => setStep("welcome")}
                className="w-full h-12 text-sm font-bold text-neutral-500 hover:text-neutral-855 hover:bg-neutral-100/50 rounded-xl transition-all active:scale-[0.98]"
              >
                Cancel & Go Back
              </button>
            </form>
          </div>
        )}

        {step === "intakeSuccess" && (
          <div className="space-y-6 rounded-[2.5rem] border border-primary-100 bg-white/85 p-10 text-center shadow-[0_16px_60px_rgb(13,148,136,0.12)] backdrop-blur-2xl animate-in zoom-in-95 duration-500">
            <div className="relative mx-auto h-24 w-24">
              <div className="absolute inset-0 rounded-full bg-primary-100 animate-ping opacity-20" />
              <div className="relative flex h-full w-full items-center justify-center rounded-full bg-primary-50 border-[6px] border-white shadow-xl">
                <HeartHandshake className="h-12 w-12 text-primary-500" />
              </div>
            </div>
            
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-neutral-900 mb-2">Registration Request Received!</h2>
              <p className="text-neutral-500 text-sm leading-relaxed">
                Your online registration has been successfully created. Our clinic team will contact you as soon as possible for appointment scheduling after reviewing your information.
              </p>
            </div>

            <Button variant="outline" className="w-full rounded-xl h-12" onClick={() => setStep("welcome")}>
              Return to Main Page
            </Button>
          </div>
        )}

        {step === "pending_approval" && (
          <div className="space-y-8 rounded-[2.5rem] border border-amber-200 bg-white/85 p-10 text-center shadow-[0_16px_50px_rgba(245,158,11,0.15)] backdrop-blur-3xl animate-in zoom-in-95 duration-500">
            <div className="relative mx-auto h-24 w-24">
              <div className="absolute inset-0 rounded-full bg-amber-100 animate-ping opacity-75" />
              <div className="relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 to-amber-500 shadow-xl shadow-amber-500/30">
                <AlertCircle className="h-12 w-12 text-white" />
              </div>
            </div>
            
            <div className="space-y-4">
              <h1 className="text-3xl font-black text-amber-800 tracking-tight">
                Registration Pending Approval
              </h1>
              <p className="text-xl font-bold text-neutral-800 leading-snug px-2">
                Kaydınız Alınmıştır, Banko Onayı Bekleniyor!
              </p>
              <p className="text-neutral-500 text-sm leading-relaxed px-4">
                Your online registration has been received but must be approved by the clinic receptionist before you can schedule an appointment. Please wait for confirmation or check with the front desk.
              </p>
            </div>

            <div className="pt-2">
              <Button 
                onClick={() => setStep("welcome")}
                className="w-full h-14 text-lg font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-2xl transition-all active:scale-[0.98]"
              >
                Return to Main Page
              </Button>
            </div>
          </div>
        )}

        {step === "provider" && (
          <div className="rounded-[2.5rem] border border-white bg-white/70 p-6 sm:p-8 shadow-[0_8px_40px_rgb(0,0,0,0.08)] backdrop-blur-2xl animate-in slide-in-from-right-8 fade-in duration-500">
            <button 
              onClick={() => setStep("identity")}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-500 hover:text-neutral-800 mb-6 transition-colors uppercase tracking-wider"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Go Back
            </button>

            <div className="mb-6">
              <h2 className="text-2xl font-extrabold text-neutral-900 tracking-tight">Doctor Selection</h2>
              <p className="text-sm text-neutral-500 mt-1">Select the doctor you wish to see.</p>
            </div>

            <div className="space-y-3">
              {providers.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleProviderSelect(p.id)}
                  className="flex w-full items-center gap-4 rounded-2xl border border-neutral-100/80 bg-white p-4 shadow-sm transition-all duration-300 hover:border-primary-200 hover:bg-primary-50/30 hover:shadow-md hover:shadow-primary-500/5 group text-left cursor-pointer active:scale-[0.99]"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 border border-primary-100 text-primary-600 group-hover:bg-primary-100 transition-colors">
                    <User className="h-6 w-6" />
                  </div>
                  <span className="text-lg font-bold text-neutral-800">{p.name}</span>
                  <ChevronRight className="ml-auto h-5 w-5 text-neutral-400 group-hover:translate-x-1 transition-transform" />
                </button>
              ))}
              {providers.length === 0 && (
                <p className="text-center text-sm text-neutral-500 py-4">No doctor is currently available.</p>
              )}
            </div>

            <button 
              type="button" 
              onClick={() => setStep("identity")}
              className="w-full h-12 mt-4 text-sm font-bold text-neutral-500 hover:text-neutral-850 hover:bg-neutral-100/50 rounded-2xl transition-all active:scale-[0.98]"
            >
              Go Back
            </button>
          </div>
        )}

        {step === "datetime" && (
          <div className="rounded-[2.5rem] border border-white bg-white/70 p-6 sm:p-8 shadow-[0_8px_40px_rgb(0,0,0,0.08)] backdrop-blur-2xl animate-in slide-in-from-right-8 fade-in duration-500">
            <button 
              onClick={() => setStep("provider")}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-500 hover:text-neutral-800 mb-6 transition-colors uppercase tracking-wider"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Go Back
            </button>

            <div className="mb-6">
              <h2 className="text-2xl font-extrabold text-neutral-900 tracking-tight">Date and Time Selection</h2>
              <p className="text-sm text-neutral-500 mt-1">Choose the time slot that suits you best.</p>
            </div>

            <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {upcomingDates.map(d => {
                const dateObj = new Date(d)
                const dayStr = dateObj.toLocaleDateString("en-US", { weekday: "short" })
                const numStr = dateObj.toLocaleDateString("en-US", { day: "numeric" })
                const isSelected = selectedDate === d
                return (
                  <button
                    key={d}
                    onClick={() => handleDateSelect(d)}
                    className={`flex flex-col items-center justify-center min-w-[4.2rem] rounded-2xl border-2 p-3 transition-all cursor-pointer ${
                      isSelected 
                        ? "bg-primary-600 text-white border-primary-600 shadow-md shadow-primary-500/20" 
                        : "bg-white text-neutral-600 border-transparent hover:border-primary-100 hover:bg-neutral-50"
                    }`}
                  >
                    <span className="text-xs uppercase font-bold tracking-wider">{dayStr}</span>
                    <span className="text-xl font-extrabold mt-0.5">{numStr}</span>
                  </button>
                )
              })}
            </div>

            <div className="mb-6 grid grid-cols-3 gap-2">
              {slots.length === 0 ? (
                <div className="col-span-3 py-6 text-center text-sm text-neutral-500">No available times on the selected date.</div>
              ) : slots.map(s => {
                const isSelected = selectedTime === s.time
                return (
                  <button
                    key={s.time}
                    disabled={!s.available}
                    onClick={() => setSelectedTime(s.time)}
                    className={`rounded-xl py-2.5 text-sm font-bold transition-all cursor-pointer ${
                      !s.available ? "bg-neutral-100 text-neutral-400 opacity-50 cursor-not-allowed border-transparent" : 
                      isSelected ? "bg-primary-600 text-white shadow-md shadow-primary-500/20 border-transparent" : "bg-white border-2 border-transparent text-neutral-700 hover:border-primary-100 hover:bg-neutral-50"
                    }`}
                  >
                    {s.time}
                    {!s.available ? (
                      <span className="ml-1 text-[10px] font-normal opacity-70">
                        ({t("portal.slotFull", "Full")})
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>

            {/* Booking Reason Dropdown */}
            <div className="mb-6 space-y-2">
              <label className="pl-1 text-xs font-bold uppercase tracking-widest text-neutral-500">
                {t("portal.reasonLabel", "Reason for visit")}
              </label>
              <select
                value={bookingReason}
                onChange={(e) => setBookingReason(e.target.value as PortalVisitReasonId)}
                className="h-12 w-full rounded-xl border-2 border-neutral-200 bg-white/80 px-4 shadow-sm text-sm outline-none focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 text-neutral-700 font-medium"
              >
                {PORTAL_VISIT_REASONS.map((reason) => (
                  <option key={reason.id} value={reason.id}>
                    {t(reason.labelKey, reason.labelFallback)}
                  </option>
                ))}
              </select>

              {bookingReason === "other" && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-250">
                  <Input
                    type="text"
                    placeholder={t("portal.reasonOtherPlaceholder", "Please specify your reason")}
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    className="h-12 rounded-xl border-2 border-neutral-200 bg-white/80 px-4 shadow-sm text-sm focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/10 placeholder:text-neutral-300 outline-none"
                    required
                  />
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-900">
                <p>{errorMsg}</p>
              </div>
            )}

            <Button
              onClick={handleBook}
              disabled={!selectedTime || submitting}
              className="group h-14 w-full rounded-2xl bg-primary-600 text-lg font-bold text-white shadow-lg shadow-primary-500/20 transition-all duration-300 hover:bg-primary-700 hover:shadow-xl"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirm Appointment"}
            </Button>

            <button 
              type="button" 
              onClick={() => setStep("provider")}
              className="w-full h-12 mt-2 text-sm font-bold text-neutral-500 hover:text-neutral-850 hover:bg-neutral-100/50 rounded-2xl transition-all active:scale-[0.98]"
            >
              Go Back
            </button>
          </div>
        )}

        {step === "success" && (
          <div className="space-y-6 rounded-[2.5rem] border border-primary-100 bg-white/85 p-10 text-center shadow-[0_16px_60px_rgb(13,148,136,0.12)] backdrop-blur-2xl animate-in zoom-in-95 duration-500">
            <div className="relative mx-auto h-24 w-24">
              <div className="absolute inset-0 rounded-full bg-primary-100 animate-ping opacity-20" />
              <div className="relative flex h-full w-full items-center justify-center rounded-full bg-primary-50 border-[6px] border-white shadow-xl">
                <CheckCircle2 className="h-12 w-12 text-primary-500" />
              </div>
            </div>
            
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-neutral-900 mb-2">Your Appointment is Booked!</h2>
              <p className="text-neutral-500 text-sm">Your appointment request has been successfully created.</p>
            </div>

            <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4 space-y-2">
              <div className="flex items-center justify-center gap-2 text-neutral-700 font-semibold text-sm">
                <CalendarIcon className="h-4 w-4 text-primary-500" />
                <span>{new Date(selectedDate).toLocaleDateString("en-US", { dateStyle: "long" })}</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-neutral-700 font-semibold text-sm">
                <Clock className="h-4 w-4 text-primary-500" />
                <span>{selectedTime}</span>
              </div>
            </div>

            <Button variant="outline" className="w-full rounded-xl h-12" onClick={() => window.location.reload()}>
              Complete
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
