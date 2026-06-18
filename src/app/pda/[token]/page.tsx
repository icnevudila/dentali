"use client"

import * as React from "react"
import { CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { PdaIntakeForm } from "@/components/pda/PdaIntakeForm"
import { useRouteParams } from "@/hooks/use-route-params"
import {
  emptyPdaIntakeResponses,
  mergePdaIntakeResponses,
  type PdaIntakeResponses,
} from "@/lib/pda/pda-intake-schema"
import { buildPdaIntakePrefill } from "@/lib/pda/pda-intake-prefill"
import { fetchPdaIntakeByToken, submitPdaIntakeViaToken } from "@/lib/pda/pda-intake-service"
import { notify } from "@/lib/ui/notify"

export default function PublicPdaIntakePage() {
  const { token } = useRouteParams<{ token: string }>()
  const [loading, setLoading] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [orgName, setOrgName] = React.useState("")
  const [patientName, setPatientName] = React.useState("")
  const [responses, setResponses] = React.useState<PdaIntakeResponses>(emptyPdaIntakeResponses())

  React.useEffect(() => {
    if (!token) return
    fetchPdaIntakeByToken(token).then(({ data, error: err }) => {
      if (err || !data) {
        setError(err ?? "This link is invalid or has expired.")
        setLoading(false)
        return
      }
      setOrgName(data.orgName)
      setPatientName(`${data.patientFirstName} ${data.patientLastName}`.trim())
      const prefill = buildPdaIntakePrefill({
        patient: {
          id: "",
          first_name: data.patientFirstName,
          last_name: data.patientLastName,
          date_of_birth: data.responses.patient.dateOfBirth || null,
          gender: data.responses.patient.sex || null,
          phone: data.responses.patient.mobile || null,
          email: data.responses.patient.email || null,
          address: data.responses.patient.address || null,
          status: "active",
        },
      })
      setResponses(mergePdaIntakeResponses(data.responses, prefill))
      setLoading(false)
    })
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setSubmitting(true)
    const { error: submitErr } = await submitPdaIntakeViaToken(token, responses)
    setSubmitting(false)
    if (submitErr) {
      notify.error(submitErr)
      return
    }
    setSubmitted(true)
  }

  if (loading) {
    return <PageLoadingSkeleton variant="form" className="mx-auto max-w-2xl px-4 py-12" />
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center space-y-4">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
        <h1 className="text-xl font-semibold text-neutral-900">Thank you</h1>
        <p className="text-sm text-neutral-600">
          Your information was sent to {orgName}. The clinic will review your form before your visit.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">{orgName}</p>
        <h1 className="text-2xl font-bold text-neutral-950">Patient information form</h1>
        <p className="text-sm text-neutral-500">
          {patientName ? `For ${patientName}. ` : ""}
          Please complete the sections below. Your dental chart will be filled in by the clinic.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
          <PdaIntakeForm
            value={responses}
            onChange={setResponses}
            readOnlySections={["chart"]}
          />
        </div>
        <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Submitting…
            </>
          ) : (
            "Submit to clinic"
          )}
        </Button>
      </form>
    </div>
  )
}
