"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { AuthMarketingPanel } from "@/components/auth/auth-marketing-panel"
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher"
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
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  if (emailSent) {
    return (
      <div className="flex min-h-screen bg-white">
        <AuthMarketingPanel variant="signup" />
        <div className="relative flex min-h-screen flex-1 items-center justify-center p-6">
          <div className="landing-hero-bg pointer-events-none absolute inset-0 opacity-30" />
          <div className="relative z-10 w-full max-w-[440px] space-y-6 rounded-3xl border border-neutral-100 bg-white/90 p-8 text-center shadow-xl backdrop-blur-md">
            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold text-neutral-900">
                {t("signup.checkEmailTitle", "Check your email")}
              </h1>
              <p className="text-sm leading-relaxed text-neutral-600">
                {t(
                  "signup.checkEmailBody",
                  "We sent a confirmation link to complete registration. After confirming, you will set up your clinic."
                )}
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 active:scale-[0.98]"
            >
              {t("marketing.signIn", "Sign in")}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-white">
      <AuthMarketingPanel variant="signup" />

      <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden">
        <div className="landing-hero-bg pointer-events-none absolute inset-0 opacity-30" />

        <header className="relative z-10 mx-auto flex w-full max-w-xl items-center justify-between px-6 py-5 lg:max-w-lg">
          <Link href="/welcome" className="text-xl font-bold tracking-tight text-neutral-900 lg:hidden">
            dentali<span className="text-primary-600">.</span>
          </Link>
          <div className="ml-auto">
            <LocaleSwitcher />
          </div>
        </header>

        <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-[460px] space-y-6 rounded-3xl border border-neutral-100 bg-white/90 p-8 shadow-xl shadow-neutral-200/50 backdrop-blur-md">
            <div className="space-y-2 text-center">
              <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">
                {t("signup.title", "Create your account")}
              </h1>
              <p className="text-sm font-medium text-neutral-500">
                {t("signup.subtitle", "Free trial — set up your organization in a few minutes.")}
              </p>
            </div>

            <form onSubmit={handleSignup} className="space-y-4" data-testid="signup-form">
              {error ? (
                <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-center text-xs font-semibold text-red-600">
                  {error}
                </div>
              ) : null}

              <div className="space-y-1">
                <label htmlFor="signup-name" className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  {t("signup.fullName", "Your name")}
                </label>
                <input
                  id="signup-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  autoComplete="name"
                  className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="signup-clinic" className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  {t("signup.clinicName", "Clinic name")}
                </label>
                <input
                  id="signup-clinic"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  placeholder="Smile Dental QC"
                  required
                  className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none placeholder-neutral-400 transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="signup-email" className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  {t("signup.email", "Work email")}
                </label>
                <input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="signup-password" className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                    {t("signup.password", "Password")}
                  </label>
                  <input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="signup-confirm" className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                    {t("signup.confirmPassword", "Confirm")}
                  </label>
                  <input
                    id="signup-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full rounded-xl bg-primary-600 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-500/20 transition duration-200 hover:bg-primary-700 active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? t("signup.creating", "Creating account…") : t("signup.submit", "Create account")}
              </button>
            </form>

            <div className="space-y-3 border-t border-neutral-100 pt-2 text-center text-sm">
              <p className="text-neutral-500">
                {t("signup.haveAccount", "Already have an account?")}{" "}
                <Link href="/login" className="font-bold text-primary-600 transition hover:text-primary-700">
                  {t("marketing.signIn", "Sign in")}
                </Link>
              </p>
              <p className="text-xs font-semibold text-neutral-500">
                {t("signup.enterprise", "Large group or custom rollout?")}{" "}
                <Link href="/quote" className="text-primary-600 transition hover:text-primary-700">
                  {t("marketing.navQuote", "Get a quote")}
                </Link>
              </p>
            </div>
          </div>
        </div>

        <footer className="relative z-10 border-t border-neutral-100 py-5 text-center text-xs font-semibold text-neutral-500">
          <div className="mx-auto flex max-w-xl justify-center gap-6">
            <Link href="/pricing" className="transition hover:text-primary-600">
              {t("marketing.navPricing", "Pricing")}
            </Link>
            <Link href="/quote" className="transition hover:text-primary-600">
              {t("marketing.navQuote", "Get a quote")}
            </Link>
            <Link href="/welcome" className="transition hover:text-primary-600">
              {t("marketing.navHome", "Home")}
            </Link>
          </div>
        </footer>
      </div>
    </div>
  )
}
