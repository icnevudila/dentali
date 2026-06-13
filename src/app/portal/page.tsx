"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { createKioskSession, submitPortalAppointment } from "@/lib/kiosk/kiosk-service"
import { fetchBranchProviderAvailability } from "@/lib/appointments/provider-availability-service"
import { fetchAvailableAppointmentSlots } from "@/lib/appointments/provider-availability-service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar as CalendarIcon, Clock, User, ChevronRight, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"

type Step = "loading" | "identity" | "provider" | "datetime" | "success" | "error"

export default function PortalPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-blue-50">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
        </div>
      }
    >
      <PortalPageContent />
    </React.Suspense>
  )
}

function PortalPageContent() {
  const searchParams = useSearchParams()
  const token = searchParams?.get("token")

  const [step, setStep] = React.useState<Step>("loading")
  const [sessionId, setSessionId] = React.useState("")
  const [branchId, setBranchId] = React.useState("")
  const [branchName, setBranchName] = React.useState("")
  const [errorMsg, setErrorMsg] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  // Form State
  const [phone, setPhone] = React.useState("")
  const [lastName, setLastName] = React.useState("")
  const [selectedProvider, setSelectedProvider] = React.useState("")
  const [selectedDate, setSelectedDate] = React.useState("")
  const [selectedTime, setSelectedTime] = React.useState("")

  // Data
  const [providers, setProviders] = React.useState<{ id: string; name: string }[]>([])
  const [slots, setSlots] = React.useState<{ time: string; available: boolean }[]>([])

  React.useEffect(() => {
    if (!token) {
      setErrorMsg("Missing portal link.")
      setStep("error")
      return
    }

    createKioskSession(token).then(({ data, error }) => {
      if (error || !data) {
        setErrorMsg(error ?? "Invalid or expired link.")
        setStep("error")
        return
      }
      setSessionId(data.session_id)
      setBranchId(data.branch_id)
      setBranchName(data.branch_name)
      setStep("identity")
    })
  }, [token])

  const handleIdentitySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone || !lastName) return
    
    // Load Providers
    setSubmitting(true)
    fetchBranchProviderAvailability(branchId).then(({ data }) => {
      setSubmitting(false)
      const uniqueProviders = Array.from(new Map(data.map(p => [p.provider_id, p])).values())
      setProviders(uniqueProviders.map(p => ({ id: p.provider_id, name: p.provider_name })))
      setStep("provider")
    })
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
    const { data, error } = await submitPortalAppointment({
      sessionId,
      phone,
      lastName,
      providerId: selectedProvider,
      date: selectedDate,
      time: selectedTime
    })
    setSubmitting(false)

    if (error || !data) {
      setErrorMsg(error ?? "Failed to book appointment.")
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

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-6 font-sans text-neutral-900 antialiased selection:bg-blue-100 selection:text-blue-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-[10%] -top-[10%] h-[50%] w-[50%] rounded-full bg-blue-200/30 blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] h-[50%] w-[50%] rounded-full bg-indigo-200/30 blur-[120px]" />
      </div>

      <p className="absolute left-0 right-0 top-6 text-center text-sm font-bold tracking-widest text-neutral-400 select-none uppercase">
        dentali<span className="text-blue-500">.</span> portal
      </p>

      <div className="relative z-10 w-full max-w-[400px]">
        {step === "loading" && (
          <div className="flex flex-col items-center justify-center space-y-4 py-20 text-neutral-400">
            <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
            <p className="text-sm font-medium tracking-wide">Connecting...</p>
          </div>
        )}

        {step === "error" && (
          <div className="rounded-3xl border border-red-100 bg-white/80 p-8 text-center shadow-xl backdrop-blur-xl">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-neutral-900 mb-2">Oops!</h2>
            <p className="text-neutral-500">{errorMsg}</p>
          </div>
        )}

        {step === "identity" && (
          <div className="rounded-[2.5rem] border border-white bg-white/70 p-8 shadow-[0_8px_40px_rgb(0,0,0,0.08)] backdrop-blur-2xl animate-in slide-in-from-bottom-8 fade-in duration-500">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 inline-flex items-center rounded-full border border-blue-200/50 bg-blue-50/50 px-4 py-1.5 text-xs font-semibold tracking-wide text-blue-700">
                ONLINE APPOINTMENTS
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
                {branchName}
              </h1>
              <p className="mt-2 text-neutral-500">Enter your details to view available slots.</p>
            </div>

            <form onSubmit={handleIdentitySubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="pl-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Phone Number
                </label>
                <Input
                  type="tel"
                  placeholder="09..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-14 rounded-2xl border-neutral-200/80 bg-white/50 px-5 text-lg shadow-sm transition-all focus:border-blue-500 focus:bg-white focus:ring-blue-500/20"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="pl-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Last Name
                </label>
                <Input
                  type="text"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="h-14 rounded-2xl border-neutral-200/80 bg-white/50 px-5 text-lg shadow-sm transition-all focus:border-blue-500 focus:bg-white focus:ring-blue-500/20"
                  required
                />
              </div>

              {errorMsg && (
                <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 flex gap-2 text-sm text-red-900 shadow-sm animate-in fade-in slide-in-from-top-2">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <p>{errorMsg}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting}
                className="group mt-2 h-14 w-full rounded-2xl bg-blue-600 text-lg font-medium shadow-md transition-all hover:bg-blue-700 hover:shadow-lg active:scale-[0.98]"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>Continue <ChevronRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" /></>
                )}
              </Button>
            </form>
          </div>
        )}

        {step === "provider" && (
          <div className="rounded-[2.5rem] border border-white bg-white/70 p-8 shadow-[0_8px_40px_rgb(0,0,0,0.08)] backdrop-blur-2xl animate-in slide-in-from-right-8 fade-in duration-500">
            <h2 className="mb-2 text-2xl font-semibold text-neutral-900">Select Dentist</h2>
            <p className="mb-6 text-neutral-500">Choose who you'd like to see.</p>
            <div className="space-y-3">
              {providers.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleProviderSelect(p.id)}
                  className="flex w-full items-center gap-4 rounded-2xl border border-neutral-100 bg-white p-4 shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50 hover:shadow-md"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    <User className="h-6 w-6" />
                  </div>
                  <span className="text-lg font-medium text-neutral-800">{p.name}</span>
                  <ChevronRight className="ml-auto h-5 w-5 text-neutral-400" />
                </button>
              ))}
              {providers.length === 0 && (
                <p className="text-center text-sm text-neutral-500 py-4">No dentists available.</p>
              )}
            </div>
            <Button variant="ghost" className="mt-6 w-full text-neutral-500" onClick={() => setStep("identity")}>
              Back
            </Button>
          </div>
        )}

        {step === "datetime" && (
          <div className="rounded-[2.5rem] border border-white bg-white/70 p-8 shadow-[0_8px_40px_rgb(0,0,0,0.08)] backdrop-blur-2xl animate-in slide-in-from-right-8 fade-in duration-500">
            <h2 className="mb-2 text-2xl font-semibold text-neutral-900">Pick a Time</h2>
            <p className="mb-6 text-neutral-500">Select a date and available slot.</p>

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
                    className={`flex flex-col items-center justify-center min-w-[4rem] rounded-xl border p-3 transition-all ${
                      isSelected ? "bg-blue-600 text-white border-blue-600 shadow-md" : "bg-white text-neutral-600 border-neutral-200 hover:border-blue-300"
                    }`}
                  >
                    <span className="text-xs uppercase">{dayStr}</span>
                    <span className="text-xl font-bold">{numStr}</span>
                  </button>
                )
              })}
            </div>

            <div className="mb-6 grid grid-cols-3 gap-2">
              {slots.length === 0 ? (
                <div className="col-span-3 py-6 text-center text-sm text-neutral-500">No slots available on this date.</div>
              ) : slots.map(s => {
                const isSelected = selectedTime === s.time
                return (
                  <button
                    key={s.time}
                    disabled={!s.available}
                    onClick={() => setSelectedTime(s.time)}
                    className={`rounded-xl py-2 text-sm font-medium transition-all ${
                      !s.available ? "bg-neutral-100 text-neutral-400 opacity-50 cursor-not-allowed" : 
                      isSelected ? "bg-blue-600 text-white shadow-md" : "bg-white border border-neutral-200 text-neutral-700 hover:border-blue-300"
                    }`}
                  >
                    {s.time}
                  </button>
                )
              })}
            </div>

            {errorMsg && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-900">
                <p>{errorMsg}</p>
              </div>
            )}

            <Button
              onClick={handleBook}
              disabled={!selectedTime || submitting}
              className="group h-14 w-full rounded-2xl bg-blue-600 text-lg font-medium shadow-md transition-all hover:bg-blue-700"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirm Booking"}
            </Button>
            <Button variant="ghost" className="mt-4 w-full text-neutral-500" onClick={() => setStep("provider")}>
              Back
            </Button>
          </div>
        )}

        {step === "success" && (
          <div className="space-y-6 rounded-[2.5rem] border border-blue-100 bg-white/80 p-10 text-center shadow-[0_16px_60px_rgb(59,130,246,0.15)] backdrop-blur-2xl animate-in zoom-in-95 duration-500">
            <div className="relative mx-auto h-24 w-24">
              <div className="absolute inset-0 rounded-full bg-blue-100 animate-ping opacity-20" />
              <div className="relative flex h-full w-full items-center justify-center rounded-full bg-blue-50 border-[6px] border-white shadow-xl">
                <CheckCircle2 className="h-12 w-12 text-blue-500" />
              </div>
            </div>
            
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-neutral-900 mb-2">See you soon!</h2>
              <p className="text-neutral-500 text-sm">Your appointment has been requested.</p>
            </div>

            <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
              <div className="flex items-center justify-center gap-2 text-neutral-700 mb-1">
                <CalendarIcon className="h-4 w-4" />
                <span className="font-medium">{selectedDate}</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-neutral-700">
                <Clock className="h-4 w-4" />
                <span className="font-medium">{selectedTime}</span>
              </div>
            </div>

            <Button variant="outline" className="w-full rounded-xl" onClick={() => window.location.reload()}>
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
