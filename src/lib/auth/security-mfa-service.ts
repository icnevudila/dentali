import { createClient } from "@/lib/supabase/client"

export type TotpFactor = {
  id: string
  friendly_name?: string
  status: "verified" | "unverified"
  factor_type: string
  created_at: string
}

export async function listMfaFactors(): Promise<{
  verified: TotpFactor[]
  unverified: TotpFactor[]
  error: string | null
}> {
  const supabase = createClient()
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) {
    return { verified: [], unverified: [], error: error.message }
  }
  return {
    verified: (data.totp ?? []).filter((f) => f.status === "verified") as TotpFactor[],
    unverified: (data.totp ?? []).filter((f) => f.status === "unverified") as TotpFactor[],
    error: null,
  }
}

export async function startTotpEnrollment(friendlyName = "Authenticator"): Promise<{
  factorId: string | null
  qrCode: string | null
  secret: string | null
  error: string | null
}> {
  const supabase = createClient()
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName,
  })
  if (error || !data) {
    return { factorId: null, qrCode: null, secret: null, error: error?.message ?? "Enrollment failed" }
  }
  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
    error: null,
  }
}

export async function verifyTotpEnrollment(
  factorId: string,
  code: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId,
  })
  if (challengeError || !challenge) {
    return { error: challengeError?.message ?? "Could not start verification" }
  }
  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: code.trim(),
  })
  return { error: error?.message ?? null }
}

export async function unenrollMfaFactor(factorId: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  return { error: error?.message ?? null }
}

export async function changePassword(password: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.auth.updateUser({ password })
  return { error: error?.message ?? null }
}
