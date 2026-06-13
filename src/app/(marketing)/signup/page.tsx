"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
    supabase.auth.getSession().then(({ data: { session } }) => {
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
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  if (emailSent) {
    return (
      <div className="px-4 py-12 sm:px-6 sm:py-16">
        <Card className="mx-auto max-w-md">
          <CardHeader className="text-center">
            <CardTitle>{t("signup.checkEmailTitle", "Check your email")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center text-sm text-neutral-600">
            <p>
              {t(
                "signup.checkEmailBody",
                "We sent a confirmation link to complete registration. After confirming, you will set up your clinic."
              )}
            </p>
            <Button variant="outline" asChild>
              <Link href="/login">{t("marketing.signIn", "Sign in")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="px-4 py-12 sm:px-6 sm:py-16">
      <Card className="mx-auto w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight text-neutral-950">
            {t("signup.title", "Create your clinic account")}
          </CardTitle>
          <p className="text-sm text-neutral-500">
            {t("signup.subtitle", "Free trial — set up your organization in a few minutes.")}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4" data-testid="signup-form">
            {error ? (
              <Badge variant="danger" className="w-full justify-center rounded-md py-2">
                {error}
              </Badge>
            ) : null}

            <div className="space-y-2">
              <label htmlFor="signup-name" className="text-sm font-medium text-neutral-700">
                {t("signup.fullName", "Your name")}
              </label>
              <Input
                id="signup-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="signup-clinic" className="text-sm font-medium text-neutral-700">
                {t("signup.clinicName", "Clinic name")}
              </label>
              <Input
                id="signup-clinic"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                placeholder="Smile Dental QC"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="signup-email" className="text-sm font-medium text-neutral-700">
                {t("signup.email", "Work email")}
              </label>
              <Input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="signup-password" className="text-sm font-medium text-neutral-700">
                {t("signup.password", "Password")}
              </label>
              <Input
                id="signup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="signup-confirm" className="text-sm font-medium text-neutral-700">
                {t("signup.confirmPassword", "Confirm password")}
              </label>
              <Input
                id="signup-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("signup.creating", "Creating account…") : t("signup.submit", "Create account")}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-500">
            {t("signup.haveAccount", "Already have an account?")}{" "}
            <Link href="/login" className="font-medium text-primary-600 hover:underline">
              {t("marketing.signIn", "Sign in")}
            </Link>
          </p>
          <p className="mt-3 text-center text-sm text-neutral-500">
            {t("signup.enterprise", "Large group or custom rollout?")}{" "}
            <Link href="/quote" className="font-medium text-primary-600 hover:underline">
              {t("marketing.navQuote", "Get a quote")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
