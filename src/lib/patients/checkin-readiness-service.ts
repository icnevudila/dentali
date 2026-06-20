import { createClient } from "@/lib/supabase/client"
import { fetchAppointments } from "@/lib/appointments/appointment-service"
import { getPatientBillingGate } from "@/lib/billing/invoice-service"
import { fetchPatientConsents } from "@/lib/patients/consent-service"
import {
  CHECKIN_REQUIRED_CONSENT_SLUGS,
  findCheckInBlockingConsentSlug,
  resolveCheckInConsentHref,
  resolveConsentDisplayStatus,
  type CheckInRequiredConsentSlug,
} from "@/lib/patients/checkin-consent"
import { toDateKey } from "@/lib/appointments/week-calendar"

export type CheckInReadinessConsent = {
  slug: CheckInRequiredConsentSlug
  label: string
  status: "not_started" | "pending" | "signed" | "voided"
}

export type CheckInReadiness = {
  patientId: string
  consents: CheckInReadinessConsent[]
  blockingConsentSlug: CheckInRequiredConsentSlug | null
  consentHref: string
  consentReady: boolean
  billing: {
    openBalance: number
    openInvoiceCount: number
    blocksCheckIn: boolean
    hasBillingGap: boolean
  }
  todayAppointment: {
    id: string
    time: string
    providerName: string | null
    status: string
  } | null
  ready: boolean
  blockers: string[]
}

const CONSENT_LABELS: Record<CheckInRequiredConsentSlug, string> = {
  "general-treatment": "Data Privacy & General Treatment Consent",
}

export async function fetchCheckInReadiness(
  patientId: string,
  branchId: string
): Promise<{ data: CheckInReadiness | null; error: string | null }> {
  const today = toDateKey(new Date())

  const [consentsRes, billingRes, appointmentsRes] = await Promise.all([
    fetchPatientConsents(patientId),
    getPatientBillingGate(patientId),
    fetchAppointments(branchId, today),
  ])

  if (consentsRes.error) return { data: null, error: consentsRes.error }
  if (billingRes.error) return { data: null, error: billingRes.error }
  if (appointmentsRes.error) return { data: null, error: appointmentsRes.error }

  const consents = consentsRes.data
  const billing = billingRes.data
  const blockingSlug = findCheckInBlockingConsentSlug(consents)

  const consentItems: CheckInReadinessConsent[] = CHECKIN_REQUIRED_CONSENT_SLUGS.map((slug) => {
    const record = consents.find((c) => c.template_slug === slug && c.status !== "voided")
    return {
      slug,
      label: record?.template_name ?? CONSENT_LABELS[slug],
      status: resolveConsentDisplayStatus(slug, consents),
    }
  })

  const appt = appointmentsRes.data.find(
    (a) =>
      a.patient_id === patientId &&
      ["scheduled", "confirmed", "checked_in"].includes(a.status)
  )

  const openBalance = billing?.open_balance ?? 0
  const billingBlocks = openBalance >= 5000

  const blockers: string[] = []
  if (blockingSlug) blockers.push("consent")
  if (billingBlocks) blockers.push("billing")

  return {
    data: {
      patientId,
      consents: consentItems,
      blockingConsentSlug: blockingSlug,
      consentHref: resolveCheckInConsentHref(patientId, consents),
      consentReady: blockingSlug === null,
      billing: {
        openBalance,
        openInvoiceCount: billing?.open_invoice_count ?? 0,
        blocksCheckIn: billingBlocks,
        hasBillingGap: Boolean(billing?.has_billing_gap),
      },
      todayAppointment: appt
        ? {
            id: appt.id,
            time: appt.scheduled_at,
            providerName: null,
            status: appt.status,
          }
        : null,
      ready: blockers.length === 0,
      blockers,
    },
    error: null,
  }
}
