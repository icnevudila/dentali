"use client"

import { use, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  FileText,
  Plus,
  Printer,
  Calendar,
  Clock,
  CheckCircle,
  Ban,
} from "lucide-react"
import { useBranch } from "@/hooks/use-branch"
import {
  fetchPatientCertificates,
  revokeMedicalCertificate,
  type MedicalCertificateRecord,
} from "@/lib/clinical/medical-certificate-service"
import { MedicalCertificateModal } from "@/components/clinical/MedicalCertificateModal"
import { PatientPageShell } from "@/components/patients/PatientPageShell"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { createClient } from "@/lib/supabase/client"
import { notify } from "@/lib/ui/notify"
import { useLocale } from "@/hooks/use-locale"

export default function PatientMedicalCertificatesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: patientId } = use(params)
  const { activeBranch } = useBranch()
  const { t } = useLocale()
  const [certificates, setCertificates] = useState<MedicalCertificateRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [patientName, setPatientName] = useState("Patient")
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!activeBranch) return
    setLoading(true)
    const res = await fetchPatientCertificates(patientId, activeBranch.id)
    setCertificates(res.data)
    setLoading(false)
  }, [activeBranch, patientId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    const supabase = createClient()
    void supabase
      .from("patients")
      .select("first_name, last_name")
      .eq("id", patientId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPatientName([data.first_name, data.last_name].filter(Boolean).join(" ") || "Patient")
        }
      })
  }, [patientId])

  const handleRevoke = async (cert: MedicalCertificateRecord) => {
    if (cert.status === "revoked") return
    const reason = window.prompt(
      "Reason for revoking this certificate? (required for audit trail)",
      "Issued in error"
    )
    if (reason === null) return
    const trimmed = reason.trim()
    if (!trimmed) {
      notify.error("A revoke reason is required.")
      return
    }
    setRevokingId(cert.id)
    const { error } = await revokeMedicalCertificate(cert.id, trimmed)
    setRevokingId(null)
    if (error) {
      notify.error(error)
      return
    }
    notify.success("Certificate revoked.")
    await loadData()
  }

  return (
    <PermissionGate permission={PERMISSIONS.PATIENTS_WRITE}>
      <PatientPageShell
        patientId={patientId}
        section="Certificates"
        title="Rest certificates"
        description="Issued rest / medical certificates for this patient. Fit-to-work letters are under a separate builder."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/patients/${patientId}/medical-certificate`}>Fit-to-work letter</Link>
            </Button>
            <Button size="sm" onClick={() => setIsModalOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              New rest certificate
            </Button>
          </div>
        }
      >
        {loading ? (
          <PageLoadingSkeleton variant="cards" />
        ) : certificates.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={t("medicalCert.emptyTitle", "No rest certificates yet")}
            description={t(
              "medicalCert.emptyHint",
              "Create an official rest certificate when the patient needs documented leave from work or school."
            )}
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button size="sm" onClick={() => setIsModalOpen(true)} className="gap-1.5">
                  <Plus className="h-4 w-4" aria-hidden />
                  {t("medicalCert.create", "Create certificate")}
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/patients/${patientId}/medical-certificate`}>
                    {t("medicalCert.fitToWork", "Fit-to-work letter")}
                  </Link>
                </Button>
              </div>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {certificates.map((cert) => {
              const revoked = cert.status === "revoked"
              return (
                <div
                  key={cert.id}
                  className="group relative flex flex-col justify-between rounded-2xl bg-white p-5 shadow-sm border border-slate-200 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-1 rounded-lg border border-teal-200/50">
                        {cert.protocol_no}
                      </span>
                      {revoked ? (
                        <Badge
                          variant="outline"
                          className="bg-red-50 text-red-700 border-red-200 text-[11px] gap-1"
                        >
                          <Ban className="h-3 w-3" />
                          Revoked
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Issued
                        </Badge>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {cert.diagnosis}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Dentist: {cert.doctor_name || "—"}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950/60 p-2.5 border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span>{cert.rest_days} rest day(s)</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span>{cert.start_date}</span>
                      </div>
                    </div>

                    {cert.notes ? (
                      <p className="text-xs text-slate-600 italic line-clamp-2">&quot;{cert.notes}&quot;</p>
                    ) : null}
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/60 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400">
                      {new Date(cert.created_at).toLocaleDateString("en-PH")}
                    </span>
                    <div className="flex gap-2">
                      {!revoked ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          disabled={revokingId === cert.id}
                          onClick={() => void handleRevoke(cert)}
                        >
                          Revoke
                        </Button>
                      ) : null}
                      <Button asChild size="sm" variant="secondary" className="h-8 text-xs gap-1">
                        <Link
                          href={`/patients/${patientId}/medical-certificate/print?certId=${cert.id}`}
                          target="_blank"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          Print
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <MedicalCertificateModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          patientId={patientId}
          branchId={activeBranch?.id ?? ""}
          patientName={patientName}
          onSuccess={() => void loadData()}
        />
      </PatientPageShell>
    </PermissionGate>
  )
}
