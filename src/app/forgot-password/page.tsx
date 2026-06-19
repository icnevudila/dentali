"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { AuthPageShell } from "@/components/auth/auth-page-shell"
import {
  AuthCardFooter,
  AuthErrorAlert,
  AuthField,
  AuthMarketingLinks,
  authFormCardClassName,
  authPrimaryButtonClassName,
} from "@/components/auth/auth-field"
import { useLocale } from "@/hooks/use-locale"
import { getSiteUrl } from "@/lib/site-url"

export default function ForgotPasswordPage() {
  const { t } = useLocale()
  const supabase = createClient()
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${getSiteUrl()}/reset-password`,
    })

    if (resetError) {
      setError(resetError.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <AuthPageShell variant="login">
      <div className={authFormCardClassName()}>
        <div className="space-y-2 text-center">
          <h1 className="font-[family-name:var(--font-clinic-display)] text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
            {t("forgotPassword.title", "Reset your password")}
          </h1>
          <p className="text-sm leading-relaxed text-neutral-500">
            {sent
              ? t(
                  "forgotPassword.successBody",
                  "If an account exists for that email, we sent a link to choose a new password."
                )
              : t(
                  "forgotPassword.subtitle",
                  "Enter your work email and we will send you a secure reset link."
                )}
          </p>
        </div>

        {sent ? (
          <AuthCardFooter>
            <Link
              href="/login"
              className={authPrimaryButtonClassName() + " inline-flex items-center justify-center"}
            >
              {t("forgotPassword.backToLogin", "Back to sign in")}
            </Link>
            <AuthMarketingLinks />
          </AuthCardFooter>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error ? <AuthErrorAlert message={error} /> : null}

              <AuthField
                id="forgot-email"
                label={t("login.email", "Email")}
                type="email"
                placeholder="doctor@clinic.com"
                value={email}
                onChange={setEmail}
                required
                autoComplete="email"
              />

              <button type="submit" disabled={loading} className={authPrimaryButtonClassName()}>
                {loading
                  ? t("forgotPassword.sending", "Sending link…")
                  : t("forgotPassword.submit", "Send reset link")}
              </button>
            </form>

            <AuthCardFooter>
              <p className="text-neutral-500">
                <Link href="/login" className="font-semibold text-primary-600 transition hover:text-primary-700">
                  {t("forgotPassword.backToLogin", "Back to sign in")}
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
