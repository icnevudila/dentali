"use client"

import { useState } from "react"
import { createMedicalCertificate, MedicalCertificateRecord } from "@/lib/clinical/medical-certificate-service"
import { FileText, Calendar, Clock, AlertCircle, CheckCircle2, X } from "lucide-react"

interface MedicalCertificateModalProps {
  isOpen: boolean
  onClose: () => void
  patientId: string
  branchId: string
  patientName: string
  onSuccess?: (cert: MedicalCertificateRecord) => void
}

export function MedicalCertificateModal({
  isOpen,
  onClose,
  patientId,
  branchId,
  patientName,
  onSuccess,
}: MedicalCertificateModalProps) {
  const [diagnosis, setDiagnosis] = useState("")
  const [restDays, setRestDays] = useState(2)
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0])
  const [notes, setNotes] = useState("")
  const [doctorName, setDoctorName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!diagnosis.trim()) {
      setErrorMsg("Lütfen geçerli bir teşhis/tanı giriniz.")
      return
    }
    if (restDays < 1) {
      setErrorMsg("İstirahat süresi en az 1 gün olmalıdır.")
      return
    }

    setIsSubmitting(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    const res = await createMedicalCertificate({
      patientId,
      branchId,
      diagnosis: diagnosis.trim(),
      restDays: Number(restDays),
      startDate,
      notes: notes.trim() || undefined,
      doctorName: doctorName.trim() || undefined,
    })

    setIsSubmitting(false)

    if (res.error || !res.data) {
      setErrorMsg(res.error ?? "Rapor oluşturulurken bir hata oluştu.")
    } else {
      setSuccessMsg("Tıbbi istirahat raporu başarıyla oluşturuldu!")
      if (onSuccess) onSuccess(res.data)
      setTimeout(() => {
        setSuccessMsg(null)
        onClose()
      }, 1200)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-all">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400 border border-teal-200/50 dark:border-teal-800/50">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Tıbbi İstirahat Raporu Düzenle
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Hasta: <span className="font-semibold text-slate-700 dark:text-slate-300">{patientName}</span>
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tanı / Klinik Teşhis *
            </label>
            <input
              type="text"
              placeholder="Örn: Akut Periapikal Absedasyon / Post-Op Cerrahi Çekim"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 focus:border-teal-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-teal-400 transition-colors"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Başlangıç Tarihi
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 focus:border-teal-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-teal-400 transition-colors"
                />
                <Calendar className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                İstirahat Süresi (Gün)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={restDays}
                  onChange={(e) => setRestDays(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 focus:border-teal-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-teal-400 transition-colors"
                />
                <Clock className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Düzenleyen Hekim Adı Unvanı (İsteğe Bağlı)
            </label>
            <input
              type="text"
              placeholder="Örn: Dr. Dt. Ahmet Yılmaz"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 focus:border-teal-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-teal-400 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Açıklama / Tıbbi Notlar
            </label>
            <textarea
              rows={3}
              placeholder="İstirahat süresince dikkat edilecek klinik hususlar ve tavsiyeler..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 focus:border-teal-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-teal-400 transition-colors"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? "Oluşturuluyor..." : "Raporu Oluştur & İmzala"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
