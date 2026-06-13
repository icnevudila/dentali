"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { useLocale } from "@/hooks/use-locale"
import { useBranch } from "@/hooks/use-branch"
import { createLabCase } from "@/lib/clinical/lab-service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"

interface NewLabCaseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function NewLabCaseDialog({ open, onOpenChange, onSuccess }: NewLabCaseDialogProps) {
  const { t } = useLocale()
  const { activeBranch } = useBranch()
  const [submitting, setSubmitting] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const [patients, setPatients] = React.useState<{id: string, first_name: string, last_name: string}[]>([])

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (open && activeBranch?.organization_id) {
      const fetchPatients = async () => {
        const supabase = createClient()
        const { data } = await supabase
          .from("patients")
          .select("id, first_name, last_name")
          .eq("organization_id", activeBranch.organization_id)
          .eq("status", "active")
          .order("last_name")
        if (data) setPatients(data)
      }
      fetchPatients()
    }
  }, [open, activeBranch?.organization_id])

  // Form state
  const [patientId, setPatientId] = React.useState("")
  const [labName, setLabName] = React.useState("")
  const [caseType, setCaseType] = React.useState("")
  const [sentDate, setSentDate] = React.useState(() => new Date().toISOString().split("T")[0])
  const [expectedDate, setExpectedDate] = React.useState("")
  const [cost, setCost] = React.useState("")
  const [notes, setNotes] = React.useState("")

  const LAB_TEMPLATES = [
    { id: "1", type: "Zirconia Crown (Single)", lab: "Aesthetic Dental Labs", price: "2500" },
    { id: "2", type: "E-Max Veneer", lab: "Smile Design Lab", price: "3500" },
    { id: "3", type: "PFM Crown", lab: "Standard Dental Labs", price: "1500" },
    { id: "4", type: "Nightguard (Hard/Soft)", lab: "Local Ortho Lab", price: "1200" },
    { id: "5", type: "Complete Denture (Upper & Lower)", lab: "Prostho Masters", price: "5000" },
  ]

  const handleTemplateSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const template = LAB_TEMPLATES.find(t => t.id === e.target.value)
    if (template) {
      setCaseType(template.type)
      setLabName(template.lab)
      setCost(template.price)
      // auto set expected date to +7 days
      const d = new Date()
      d.setDate(d.getDate() + 7)
      setExpectedDate(d.toISOString().split("T")[0])
    }
  }

  if (!open || !mounted) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeBranch?.id) return
    if (!patientId || !labName || !caseType || !sentDate) {
      toast.error(t("labcases.error.required", "Please fill all required fields."))
      return
    }

    setSubmitting(true)
    const { error } = await createLabCase({
      branch_id: activeBranch.id,
      patient_id: patientId,
      provider_id: null,
      lab_name: labName,
      case_type: caseType,
      sent_date: sentDate,
      expected_date: expectedDate || null,
      received_date: null,
      cost: parseFloat(cost) || 0,
      notes: notes || null,
    })
    setSubmitting(false)

    if (error) {
      toast.error(error)
    } else {
      toast.success(t("labcases.success.created", "Lab case successfully created!"))
      onSuccess()
      onOpenChange(false)
      // reset
      setPatientId("")
      setLabName("")
      setCaseType("")
      setExpectedDate("")
      setCost("")
      setNotes("")
    }
  }

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        <div className="p-6 overflow-y-auto">
          <h2 className="text-lg font-semibold text-neutral-900">{t("labcases.new.title", "New Lab Case")}</h2>
          <p className="text-sm text-neutral-500 mt-1">
            {t("labcases.new.desc", "Send an impression or order to an external lab.")}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                Quick Select from Catalog
              </label>
              <select
                onChange={handleTemplateSelect}
                className="w-full mt-1 rounded-md border border-emerald-300 bg-white px-3 h-9 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-emerald-900"
                defaultValue=""
              >
                <option value="" disabled>-- Select a predefined lab procedure --</option>
                {LAB_TEMPLATES.map(t => (
                  <option key={t.id} value={t.id}>{t.type} - ₱{t.price} ({t.lab})</option>
                ))}
              </select>
              <p className="text-[10px] text-emerald-600 mt-1">Select a procedure to auto-fill the form below.</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Patient*
              </label>
              <select
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                required
                className="w-full rounded-md border border-neutral-300 bg-white px-3 h-10 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="" disabled>Select a patient</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.last_name}, {p.first_name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                {t("labcases.field.labName", "Laboratory Name*")}
              </label>
              <Input
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
                placeholder="e.g. Aesthetic Dental Labs"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                {t("labcases.field.caseType", "Case Type*")}
              </label>
              <Input
                value={caseType}
                onChange={(e) => setCaseType(e.target.value)}
                placeholder="e.g. Zirconia Crown (Tooth 14)"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  {t("labcases.field.sentDate", "Sent Date*")}
                </label>
                <Input
                  type="date"
                  value={sentDate}
                  onChange={(e) => setSentDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  {t("labcases.field.expectedDate", "Expected Back")}
                </label>
                <Input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                {t("labcases.field.cost", "Lab Cost (₱)")}
              </label>
              <Input
                type="number"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                {t("labcases.field.notes", "Notes / Instructions")}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Shade A2, please rush if possible."
                className="w-full resize-none rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
                rows={3}
              />
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                {t("common.cancel", "Cancel")}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("common.save", "Save")}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
