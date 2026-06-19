"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { AuthPageShell } from "@/components/auth/auth-page-shell"
import {
  AuthCardFooter,
  AuthErrorAlert,
  AuthField,
  AuthMarketingLinks,
  AuthPasswordField,
  authFormCardClassName,
  authPrimaryButtonClassName,
} from "@/components/auth/auth-field"
import { useLocale } from "@/hooks/use-locale"
import { getSiteUrl } from "@/lib/site-url"

export default function SignupPage() {
  const { t } = useLocale()
  const router = useRouter()
  const supabase = createClient()

  const [fullName, setFullName] = useState("")
  const [clinicName, setClinicName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [emailSent, setEmailSent] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then((res: { data?: { session?: unknown } }) => {
      const session = res.data?.session
      if (session) router.replace("/onboarding")
      setCheckingSession(false)
    })
  }, [router, supabase.auth])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError(t("signup.passwordMin", "Password must be at least 8 characters."))
      return
    }
    if (password !== confirmPassword) {
      setError(t("signup.passwordMatch", "Passwords do not match."))
      return
    }

    setLoading(true)

    const siteUrl = getSiteUrl()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          clinic_name: clinicName.trim() || undefined,
        },
        emailRedirectTo: `${siteUrl}/onboarding`,
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (data.session) {
      router.push("/onboarding")
      router.refresh()
      return
    }

    setEmailSent(true)
    setLoading(false)
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-neutral-100">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <AuthPageShell variant="signup">
      <div className={authFormCardClassName()}>
        {emailSent ? (
          <>
            <div className="space-y-2 text-center">
              <h1 className="font-[family-name:var(--font-clinic-display)] text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
                {t("signup.checkEmailTitle", "Check your email")}
              </h1>
              <p className="text-sm leading-relaxed text-neutral-500">
                {t(
                  "signup.checkEmailBody",
                  "We sent a confirmation link to complete registration. After confirming, you will set up your clinic."
                )}
              </p>
            </div>

            <AuthCardFooter>
              <Link
                href="/login"
                className={authPrimaryButtonClassName() + " inline-flex items-center justify-center"}
              >
                {t("marketing.signIn", "Sign in")}
              </Link>
              <AuthMarketingLinks />
            </AuthCardFooter>
          </>
        ) : (
          <>
            <div className="space-y-2 text-center sm:space-y-2.5">
              <h1 className="font-[family-name:var(--font-clinic-display)] text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
                {t("signup.title", "Create your account")}
              </h1>
              <p className="text-sm leading-relaxed text-neutral-500">
                {t("signup.subtitle", "Free trial — set up your organization in a few minutes.")}
              </p>
            </div>

            <form onSubmit={handleSignup} className="space-y-4" data-testid="signup-form">
              {error ? <AuthErrorAlert message={error} /> : null}

              <AuthField
                id="signup-name"
                label={t("signup.fullName", "Your name")}
                value={fullName}
                onChange={setFullName}
                required
                autoComplete="name"
              />
              <AuthField
                id="signup-clinic"
                label={t("signup.clinicName", "Clinic name")}
                value={clinicName}
                onChange={setClinicName}
                placeholder="Smile Dental QC"
                required
              />
              <AuthField
                id="signup-email"
                label={t("signup.email", "Work email")}
                type="email"
                value={email}
                onChange={setEmail}
                required
                autoComplete="email"
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <AuthPasswordField
                  id="signup-password"
                  label={t("signup.password", "Password")}
                  value={password}
                  onChange={setPassword}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <AuthPasswordField
                  id="signup-confirm"
                  label={t("signup.confirmPassword", "Confirm")}
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>

              <button type="submit" disabled={loading} className={authPrimaryButtonClassName()}>
                {loading ? t("signup.creating", "Creating account…") : t("signup.submit", "Create account")}
              </button>
            </form>

            <AuthCardFooter>
              <p className="text-neutral-500">
                {t("signup.haveAccount", "Already have an account?")}{" "}
                <Link href="/login" className="font-semibold text-primary-600 transition hover:text-primary-700">
                  {t("marketing.signIn", "Sign in")}
                </Link>
              </p>
              <AuthMarketingLinks />
            </AuthCardFooter>
          </>
        )}
      </div>
    </AuthPageShell>
  )
}
