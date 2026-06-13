"use client"

import * as React from "react"
import { useLocale } from "@/hooks/use-locale"
import { useBranchContext } from "@/lib/context/BranchContext"
import { createLabCase } from "@/lib/clinical/lab-service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

interface NewLabCaseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function NewLabCaseDialog({ open, onOpenChange, onSuccess }: NewLabCaseDialogProps) {
  const { t } = useLocale()
  const branchId = useBranchContext()
  const [submitting, setSubmitting] = React.useState(false)

  // Form state
  const [patientId, setPatientId] = React.useState("")
  const [labName, setLabName] = React.useState("")
  const [caseType, setCaseType] = React.useState("")
  const [sentDate, setSentDate] = React.useState(() => new Date().toISOString().split("T")[0])
  const [expectedDate, setExpectedDate] = React.useState("")
  const [cost, setCost] = React.useState("")
  const [notes, setNotes] = React.useState("")

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!branchId) return
    if (!patientId || !labName || !caseType || !sentDate) {
      toast.error(t("labcases.error.required", "Please fill all required fields."))
      return
    }

    setSubmitting(true)
    const { error } = await createLabCase({
      branch_id: branchId,
      patient_id: patientId,
      provider_id: null,
      lab_name: labName,
      case_type: caseType,
      sent_date: sentDate,
      expected_date: expectedDate || null,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-neutral-900">{t("labcases.new.title", "New Lab Case")}</h2>
          <p className="text-sm text-neutral-500 mt-1">
            {t("labcases.new.desc", "Send an impression or order to an external lab.")}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Patient ID (UUID)*
              </label>
              <Input
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000"
                required
              />
              <p className="text-[10px] text-neutral-400">For the demo, paste any patient's UUID here.</p>
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
}
