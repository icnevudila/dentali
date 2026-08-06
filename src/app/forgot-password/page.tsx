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

function mapResetRequestError(raw: string, t: (key: string, fallback: string) => string): string {
  const m = raw.toLowerCase()
  if (m.includes("rate limit") || m.includes("too many")) {
    return t("login.rateLimited", "Too many attempts. Wait a moment, then try again.")
  }
  if (m.includes("fetch") || m.includes("network") || m.includes("failed to fetch")) {
    return t("login.networkError", "Could not reach the sign-in service. Check your connection and retry.")
  }
  return t("forgotPassword.genericError", "Could not send a reset link right now. Try again in a moment.")
}

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

    if (!email.trim()) {
      setError(t("forgotPassword.emailRequired", "Enter the email address for your staff account."))
      return
    }

    setLoading(true)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${getSiteUrl()}/reset-password`,
    })

    if (resetError) {
      setError(mapResetRequestError(resetError.message, t))
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
                  "Enter your work email and we will send a secure reset link if an account exists."
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
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
