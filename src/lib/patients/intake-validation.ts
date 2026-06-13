import { createClient } from "@/lib/supabase/client"
import type { PatientFormValues } from "@/lib/validations/patient"

export interface IntakeValidationResult {
  valid: boolean
  missing_fields: string[]
  warnings: string[]
}

export function formToIntakePayload(form: PatientFormValues) {
  return {
    first_name: form.firstName,
    last_name: form.lastName,
    date_of_birth: form.dateOfBirth || null,
    gender: form.gender,
    phone: form.phoneNumber,
    email: form.email || null,
    address_line1: form.addressLine1,
    city: form.city,
    emergency_contact_name: form.emergencyContactName || null,
    emergency_contact_phone: form.emergencyContactPhone || null,
    medical_alerts: form.medicalAlerts || null,
  }
}

const WARNING_LABELS: Record<string, string> = {
  phone_format: "Phone number may be invalid (expect at least 10 digits).",
  email_format: "Email address format looks invalid.",
  emergency_phone_missing: "Emergency contact name provided without a phone number.",
}

const FIELD_LABELS: Record<string, string> = {
  first_name: "First name",
  last_name: "Last name",
  date_of_birth: "Date of birth",
  phone: "Phone number",
  address_line1: "Street address",
  city: "City",
}

export function labelMissingField(field: string): string {
  return FIELD_LABELS[field] ?? field
}

export function labelWarning(code: string): string {
  return WARNING_LABELS[code] ?? code
}

/** Client fallback when migration not yet pushed to Supabase. */
export function validateIntakeCompletenessLocal(
  payload: ReturnType<typeof formToIntakePayload>
): IntakeValidationResult {
  const missing: string[] = []
  const warnings: string[] = []

  if (!payload.first_name?.trim()) missing.push("first_name")
  if (!payload.last_name?.trim()) missing.push("last_name")
  if (!payload.date_of_birth) missing.push("date_of_birth")

  const phone = payload.phone?.trim() ?? ""
  if (!phone) {
    missing.push("phone")
  } else if (phone.replace(/\D/g, "").length < 10) {
    warnings.push("phone_format")
  }

  if (!payload.address_line1?.trim()) missing.push("address_line1")
  if (!payload.city?.trim()) missing.push("city")

  const email = payload.email?.trim() ?? ""
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    warnings.push("email_format")
  }

  if (payload.emergency_contact_name?.trim() && !payload.emergency_contact_phone?.trim()) {
    warnings.push("emergency_phone_missing")
  }

  return { valid: missing.length === 0, missing_fields: missing, warnings }
}

function isMissingRpcError(message: string): boolean {
  return /could not find the function|schema cache|PGRST202/i.test(message)
}

export async function validateIntakeCompleteness(
  form: PatientFormValues
): Promise<{ data: IntakeValidationResult | null; error: string | null }> {
  const payload = formToIntakePayload(form)
  const supabase = createClient()
  const { data, error } = await supabase.rpc("validate_intake_completeness", {
    p_payload: payload,
  })

  if (error) {
    if (isMissingRpcError(error.message)) {
      return { data: validateIntakeCompletenessLocal(payload), error: null }
    }
    return { data: null, error: error.message }
  }

  const raw = data as {
    valid: boolean
    missing_fields: string[]
    warnings: string[]
  }

  return {
    data: {
      valid: Boolean(raw.valid),
      missing_fields: raw.missing_fields ?? [],
      warnings: raw.warnings ?? [],
    },
    error: null,
  }
}
