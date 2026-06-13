"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { createKioskSession, submitPortalAppointment, verifyPortalPatient, submitKioskIntake } from "@/lib/kiosk/kiosk-service"
import { fetchBranchProviderAvailability } from "@/lib/appointments/provider-availability-service"
import { fetchAvailableAppointmentSlots } from "@/lib/appointments/provider-availability-service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

  // Kayıtlı Hasta Form State
  const [phone, setPhone] = React.useState("")
  const [lastName, setLastName] = React.useState("")
  const [selectedProvider, setSelectedProvider] = React.useState("")
  const [selectedDate, setSelectedDate] = React.useState("")
  const [selectedTime, setSelectedTime] = React.useState("")

  // Yeni Hasta Kayıt Form State
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
      setErrorMsg("Portal bağlantı anahtarı eksik.")
      setStep("error")
      return
    }

    createKioskSession(token).then(({ data, error }) => {
      if (error || !data) {
        setErrorMsg(error ?? "Bağlantı geçersiz veya süresi dolmuş.")
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
      setErrorMsg("Kayıt bulunamadı. Lütfen bilgilerinizi kontrol edin veya Yeni Hasta Kaydı oluşturun.")
      return
    }

    const { data } = await fetchBranchProviderAvailability(branchId)
    setSubmitting(false)
    const uniqueProviders = Array.from(new Map(data.map(p => [p.provider_id, p])).values())
    setProviders(uniqueProviders.map(p => ({ id: p.provider_id, name: p.provider_name })))
    setStep("provider")
  }

  const handleNewPatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFirstName || !newLastName || !newPhone) {
      setErrorMsg("Ad, soyad ve telefon alanları zorunludur.")
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
      setErrorMsg(error ?? "Kayıt oluşturulurken bir hata oluştu.")
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
      setErrorMsg(error ?? "Randevu oluşturulurken bir sorun oluştu.")
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
  const renderStepper = (current: number, total: number) => {
    return (
      <div className="flex items-center justify-center gap-1.5 mb-6">
        {Array.from({ length: total }).map((_, i) => (
          <div 
            key={i} 
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i + 1 === current 
                ? "w-8 bg-blue-600" 
                : i + 1 < current 
                  ? "w-2 bg-blue-400" 
                  : "w-2 bg-neutral-200"
            }`}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-4 sm:p-6 font-sans text-neutral-900 antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* Background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-[10%] -top-[10%] h-[50%] w-[50%] rounded-full bg-blue-200/30 blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] h-[50%] w-[50%] rounded-full bg-indigo-200/30 blur-[120px]" />
      </div>

      <p className="absolute left-0 right-0 top-6 text-center text-sm font-bold tracking-widest text-neutral-400 select-none uppercase">
        dentali<span className="text-blue-500">.</span> portal
      </p>

      <div className="relative z-10 w-full max-w-[440px] my-12">
        {step === "loading" && (
          <div className="flex flex-col items-center justify-center space-y-4 py-20 text-neutral-400">
            <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
            <p className="text-sm font-medium tracking-wide">Bağlantı kuruluyor...</p>
          </div>
        )}

        {step === "error" && (
          <div className="rounded-3xl border border-red-100 bg-white/80 p-8 text-center shadow-xl backdrop-blur-xl">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-neutral-900 mb-2">Hata</h2>
            <p className="text-neutral-500">{errorMsg}</p>
          </div>
        )}

        {step === "welcome" && (
          <div className="rounded-[2.5rem] border border-white bg-white/70 p-6 sm:p-8 shadow-[0_8px_40px_rgb(0,0,0,0.08)] backdrop-blur-2xl animate-in slide-in-from-bottom-8 fade-in duration-500">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 inline-flex items-center rounded-full border border-blue-200/50 bg-blue-50/50 px-4 py-1.5 text-xs font-semibold tracking-wide text-blue-700">
                ONLINE RANDEVU SİSTEMİ
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
                {branchName}
              </h1>
              <p className="mt-2 text-neutral-500">Lütfen devam etmek için durumunuzu seçin.</p>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => setStep("identity")}
                className="flex w-full items-center gap-4 rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50/50 hover:shadow-md group text-left"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <UserCheck className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-neutral-800">Kayıtlı Hastayım</h3>
                  <p className="text-xs text-neutral-500 mt-0.5">Daha önce kliniğimize geldiyseniz hızlıca randevu alın.</p>
                </div>
                <ChevronRight className="ml-auto h-5 w-5 text-neutral-400 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => setStep("intakeForm")}
                className="flex w-full items-center gap-4 rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50/50 hover:shadow-md group text-left"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                  <UserPlus className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-neutral-800">Yeni Hastayım</h3>
                  <p className="text-xs text-neutral-500 mt-0.5">Kliniğimizde ilk randevunuz ise online kayıt oluşturun.</p>
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
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-800 mb-6 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Geri Dön
            </button>

            {renderStepper(1, 4)}

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-neutral-900">Kimlik Doğrulama</h2>
              <p className="text-sm text-neutral-500 mt-1">Kayıtlı bilgilerinizi girerek devam edin.</p>
            </div>

            <form onSubmit={handleIdentitySubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="pl-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Telefon Numarası
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
                  <Input
                    type="tel"
                    placeholder="09XXXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-14 rounded-2xl border-neutral-200/80 bg-white/50 pl-12 pr-5 text-lg shadow-sm transition-all focus:border-blue-500 focus:bg-white focus:ring-blue-500/20"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="pl-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Soyadı
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
                  <Input
                    type="text"
                    placeholder="Soyadınızı girin"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="h-14 rounded-2xl border-neutral-200/80 bg-white/50 pl-12 pr-5 text-lg shadow-sm transition-all focus:border-blue-500 focus:bg-white focus:ring-blue-500/20"
                    required
                  />
                </div>
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
                  <>Devam Et <ChevronRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" /></>
                )}
              </Button>
            </form>
          </div>
        )}

        {step === "intakeForm" && (
          <div className="rounded-[2.5rem] border border-white bg-white/70 p-6 sm:p-8 shadow-[0_8px_40px_rgb(0,0,0,0.08)] backdrop-blur-2xl animate-in slide-in-from-bottom-8 fade-in duration-500">
            <button 
              onClick={() => setStep("welcome")}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-800 mb-6 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Geri Dön
            </button>

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-neutral-900">Yeni Hasta Kaydı</h2>
              <p className="text-sm text-neutral-500 mt-1">Lütfen aşağıdaki formu eksiksiz doldurun.</p>
            </div>

            <form onSubmit={handleNewPatientSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="pl-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">Adı</label>
                  <Input
                    type="text"
                    placeholder="Ahmet"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    className="h-12 rounded-xl border-neutral-200 bg-white/50 px-4 shadow-sm"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="pl-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">Soyadı</label>
                  <Input
                    type="text"
                    placeholder="Yılmaz"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    className="h-12 rounded-xl border-neutral-200 bg-white/50 px-4 shadow-sm"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="pl-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">Telefon Numarası</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <Input
                    type="tel"
                    placeholder="05XXXXXXXXX"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="h-12 rounded-xl border-neutral-200 bg-white/50 pl-10 pr-4 shadow-sm"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="pl-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">E-posta Adresi</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <Input
                    type="email"
                    placeholder="ahmet@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="h-12 rounded-xl border-neutral-200 bg-white/50 pl-10 pr-4 shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="pl-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">Doğum Tarihi</label>
                  <div className="relative">
                    <CalendarDays className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <Input
                      type="date"
                      value={newDob}
                      onChange={(e) => setNewDob(e.target.value)}
                      className="h-12 rounded-xl border-neutral-200 bg-white/50 pl-10 pr-4 shadow-sm text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="pl-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">Cinsiyet</label>
                  <select
                    value={newGender}
                    onChange={(e) => setNewGender(e.target.value)}
                    className="h-12 w-full rounded-xl border border-neutral-200 bg-white/50 px-3 shadow-sm text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="male">Erkek</option>
                    <option value="female">Kadın</option>
                    <option value="other">Diğer / Belirtmek İstemiyorum</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="pl-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">Adres</label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <Input
                      type="text"
                      placeholder="Mahalle, Sokak"
                      value={newAddress}
                      onChange={(e) => setNewAddress(e.target.value)}
                      className="h-12 rounded-xl border-neutral-200 bg-white/50 pl-10 pr-4 shadow-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="pl-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">Şehir</label>
                  <Input
                    type="text"
                    placeholder="İstanbul"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    className="h-12 rounded-xl border-neutral-200 bg-white/50 px-4 shadow-sm"
                  />
                </div>
              </div>

              <div className="border-t border-neutral-100 pt-4 mt-2">
                <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3">Acil Durum İletişim Bilgileri</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="pl-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">Kişi Adı</label>
                    <Input
                      type="text"
                      placeholder="Yakınınızın Adı"
                      value={newEmergencyName}
                      onChange={(e) => setNewEmergencyName(e.target.value)}
                      className="h-12 rounded-xl border-neutral-200 bg-white/50 px-4 shadow-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="pl-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">Telefonu</label>
                    <Input
                      type="tel"
                      placeholder="05XXXXXXXXX"
                      value={newEmergencyPhone}
                      onChange={(e) => setNewEmergencyPhone(e.target.value)}
                      className="h-12 rounded-xl border-neutral-200 bg-white/50 px-4 shadow-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 border-t border-neutral-100 pt-4">
                <label className="pl-1 text-xs font-semibold uppercase tracking-wider text-neutral-500 flex items-center gap-1">
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-500" /> Tıbbi Geçmiş / Alerjiler
                </label>
                <textarea
                  placeholder="Varsa kronik hastalıklarınız, kullandığınız ilaçlar veya alerjileriniz..."
                  value={newMedicalAlerts}
                  onChange={(e) => setNewMedicalAlerts(e.target.value)}
                  className="w-full min-h-[80px] rounded-xl border border-neutral-200 bg-white/50 p-3 text-sm shadow-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
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
                className="group h-12 w-full rounded-xl bg-blue-600 font-medium shadow-md transition-all hover:bg-blue-700 active:scale-[0.98]"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>Kayıt Talebini Gönder <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" /></>
                )}
              </Button>
            </form>
          </div>
        )}

        {step === "intakeSuccess" && (
          <div className="space-y-6 rounded-[2.5rem] border border-indigo-100 bg-white/80 p-10 text-center shadow-[0_16px_60px_rgb(99,102,241,0.15)] backdrop-blur-2xl animate-in zoom-in-95 duration-500">
            <div className="relative mx-auto h-24 w-24">
              <div className="absolute inset-0 rounded-full bg-indigo-100 animate-ping opacity-20" />
              <div className="relative flex h-full w-full items-center justify-center rounded-full bg-indigo-50 border-[6px] border-white shadow-xl">
                <HeartHandshake className="h-12 w-12 text-indigo-500" />
              </div>
            </div>
            
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-neutral-900 mb-2">Kayıt Talebiniz Alındı!</h2>
              <p className="text-neutral-500 text-sm leading-relaxed">
                Online kaydınız başarıyla oluşturuldu. Klinik ekibimiz bilgilerinizi inceledikten sonra randevu planlaması için sizinle en kısa sürede iletişime geçecektir.
              </p>
            </div>

            <Button variant="outline" className="w-full rounded-xl h-12" onClick={() => setStep("welcome")}>
              Ana Sayfaya Dön
            </Button>
          </div>
        )}

        {step === "provider" && (
          <div className="rounded-[2.5rem] border border-white bg-white/70 p-6 sm:p-8 shadow-[0_8px_40px_rgb(0,0,0,0.08)] backdrop-blur-2xl animate-in slide-in-from-right-8 fade-in duration-500">
            <button 
              onClick={() => setStep("identity")}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-800 mb-6 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Geri Dön
            </button>

            {renderStepper(2, 4)}

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-neutral-900">Hekim Seçimi</h2>
              <p className="text-sm text-neutral-500 mt-1">Görüşmek istediğiniz hekimi seçin.</p>
            </div>

            <div className="space-y-3">
              {providers.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleProviderSelect(p.id)}
                  className="flex w-full items-center gap-4 rounded-2xl border border-neutral-100 bg-white p-4 shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50/50 hover:shadow-md group text-left"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                    <User className="h-6 w-6" />
                  </div>
                  <span className="text-lg font-semibold text-neutral-800">{p.name}</span>
                  <ChevronRight className="ml-auto h-5 w-5 text-neutral-400 group-hover:translate-x-1 transition-transform" />
                </button>
              ))}
              {providers.length === 0 && (
                <p className="text-center text-sm text-neutral-500 py-4">Şu an uygun hekim bulunmamaktadır.</p>
              )}
            </div>
          </div>
        )}

        {step === "datetime" && (
          <div className="rounded-[2.5rem] border border-white bg-white/70 p-6 sm:p-8 shadow-[0_8px_40px_rgb(0,0,0,0.08)] backdrop-blur-2xl animate-in slide-in-from-right-8 fade-in duration-500">
            <button 
              onClick={() => setStep("provider")}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-800 mb-6 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Geri Dön
            </button>

            {renderStepper(3, 4)}

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-neutral-900">Tarih ve Saat Seçimi</h2>
              <p className="text-sm text-neutral-500 mt-1">Size en uygun zaman dilimini belirleyin.</p>
            </div>

            <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {upcomingDates.map(d => {
                const dateObj = new Date(d)
                const dayStr = dateObj.toLocaleDateString("tr-TR", { weekday: "short" })
                const numStr = dateObj.toLocaleDateString("tr-TR", { day: "numeric" })
                const isSelected = selectedDate === d
                return (
                  <button
                    key={d}
                    onClick={() => handleDateSelect(d)}
                    className={`flex flex-col items-center justify-center min-w-[4.2rem] rounded-xl border p-3 transition-all ${
                      isSelected ? "bg-blue-600 text-white border-blue-600 shadow-md" : "bg-white text-neutral-600 border-neutral-200 hover:border-blue-300"
                    }`}
                  >
                    <span className="text-xs uppercase font-semibold">{dayStr}</span>
                    <span className="text-xl font-bold mt-0.5">{numStr}</span>
                  </button>
                )
              })}
            </div>

            <div className="mb-6 grid grid-cols-3 gap-2">
              {slots.length === 0 ? (
                <div className="col-span-3 py-6 text-center text-sm text-neutral-500">Seçilen tarihte uygun saat bulunmamaktadır.</div>
              ) : slots.map(s => {
                const isSelected = selectedTime === s.time
                return (
                  <button
                    key={s.time}
                    disabled={!s.available}
                    onClick={() => setSelectedTime(s.time)}
                    className={`rounded-xl py-2.5 text-sm font-semibold transition-all ${
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
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Randevuyu Onayla"}
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
              <h2 className="text-2xl font-bold tracking-tight text-neutral-900 mb-2">Randevunuz Alındı!</h2>
              <p className="text-neutral-500 text-sm">Randevu talebiniz başarıyla oluşturuldu.</p>
            </div>

            <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4 space-y-2">
              <div className="flex items-center justify-center gap-2 text-neutral-700">
                <CalendarIcon className="h-4 w-4 text-blue-500" />
                <span className="font-semibold">{new Date(selectedDate).toLocaleDateString("tr-TR", { dateStyle: "long" })}</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-neutral-700">
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="font-semibold">{selectedTime}</span>
              </div>
            </div>

            <Button variant="outline" className="w-full rounded-xl h-12" onClick={() => window.location.reload()}>
              Tamamla
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
