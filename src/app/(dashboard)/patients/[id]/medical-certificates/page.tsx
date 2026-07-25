"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { useBranch } from "@/hooks/use-branch"
import { fetchPatientCertificates, MedicalCertificateRecord } from "@/lib/clinical/medical-certificate-service"
import { MedicalCertificateModal } from "@/components/clinical/MedicalCertificateModal"
import { FileText, Plus, Printer, Calendar, Clock, CheckCircle, ShieldCheck } from "lucide-react"

export default function PatientMedicalCertificatesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = use(params)
  const { activeBranch } = useBranch()
  const [certificates, setCertificates] = useState<MedicalCertificateRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [patientName, setPatientName] = useState("Hasta")

  const loadData = async () => {
    if (!activeBranch) return
    setLoading(true)
    const res = await fetchPatientCertificates(patientId, activeBranch.id)
    setCertificates(res.data)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [patientId, activeBranch?.id])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-teal-900 to-slate-900 p-6 text-white shadow-xl border border-teal-800/40">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-teal-500/20 px-3 py-1 text-xs font-semibold text-teal-300 border border-teal-500/30">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Klinik Muayene & Resmi Rapor Yönetimi</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Tıbbi İstirahat Raporları</h1>
          <p className="text-xs text-slate-300">
            Hastaya verilen istirahat belgelerini, klinik tanı kayıtlarını ve yazdırma nüshalarını yönetin.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-xs font-semibold text-slate-950 shadow-lg hover:bg-teal-400 transition-colors shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Yeni Rapor Oluştur</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
            <span>Raporlar yükleniyor...</span>
          </div>
        </div>
      ) : certificates.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <FileText className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Henüz Medikal Rapor Yok</h3>
          <p className="text-xs text-slate-500 max-w-sm">
            Bu hasta için kayıtlı tıbbi istirahat veya muayene raporu bulunmamaktadır.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Rapor Düzenle</span>
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {certificates.map((cert) => (
            <div
              key={cert.id}
              className="group relative flex flex-col justify-between rounded-2xl bg-white p-5 shadow-sm hover:shadow-md border border-slate-200 dark:border-slate-800 dark:bg-slate-900 transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-1 rounded-lg border border-teal-200/50 dark:border-teal-800/50">
                    {cert.protocol_no}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                    <CheckCircle className="h-3 w-3" />
                    <span>Resmi Nüsha</span>
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{cert.diagnosis}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Hekim: {cert.doctor_name || "Dt. Dr."}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950/60 p-2.5 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <span>{cert.rest_days} Gün İstirahat</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>{cert.start_date}</span>
                  </div>
                </div>

                {cert.notes && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 italic line-clamp-2">
                    &quot;{cert.notes}&quot;
                  </p>
                )}
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {new Date(cert.created_at).toLocaleDateString("tr-TR")}
                </span>

                <Link
                  href={`/patients/${patientId}/medical-certificate/print?certId=${cert.id}`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Resmi Yazdır</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <MedicalCertificateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        patientId={patientId}
        branchId={activeBranch?.id ?? ""}
        patientName={patientName}
        onSuccess={() => loadData()}
      />
    </div>
  )
}
