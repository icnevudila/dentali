"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { AuthPageShell } from "@/components/auth/auth-page-shell"
import {
  AuthCardFooter,
  AuthErrorAlert,
  AuthMarketingLinks,
  AuthPasswordField,
  authFormCardClassName,
  authPrimaryButtonClassName,
} from "@/components/auth/auth-field"
import { useLocale } from "@/hooks/use-locale"

export default function ResetPasswordPage() {
  const { t } = useLocale()
  const router = useRouter()
  const supabase = createClient()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true)
        setChecking(false)
      }
    })

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true)
      }
      setChecking(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  const handleSubmit = async (e: React.FormEvent) => {
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
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  if (checking) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-neutral-100">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <AuthPageShell variant="login">
      <div className={authFormCardClassName()}>
        <div className="space-y-2 text-center">
          <h1 className="font-[family-name:var(--font-clinic-display)] text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
            {t("resetPassword.title", "Choose a new password")}
          </h1>
          <p className="text-sm leading-relaxed text-neutral-500">
            {ready
              ? t("resetPassword.subtitle", "Enter and confirm your new password below.")
              : t(
                  "resetPassword.invalidLink",
                  "This reset link is invalid or has expired. Request a new one from the sign-in page."
                )}
          </p>
        </div>

        {ready ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error ? <AuthErrorAlert message={error} /> : null}

            <AuthPasswordField
              id="reset-password"
              label={t("signup.password", "Password")}
              value={password}
              onChange={setPassword}
              required
              minLength={8}
              autoComplete="new-password"
            />
            <AuthPasswordField
              id="reset-confirm"
              label={t("signup.confirmPassword", "Confirm")}
              value={confirmPassword}
              onChange={setConfirmPassword}
              required
              minLength={8}
              autoComplete="new-password"
            />

            <button type="submit" disabled={loading} className={authPrimaryButtonClassName()}>
              {loading
                ? t("resetPassword.saving", "Saving password…")
                : t("resetPassword.submit", "Update password")}
            </button>
          </form>
        ) : null}

        <AuthCardFooter>
          <p className="text-neutral-500">
            <Link href="/forgot-password" className="font-semibold text-primary-600 transition hover:text-primary-700">
              {t("forgotPassword.title", "Reset your password")}
            </Link>
            {" · "}
            <Link href="/login" className="font-semibold text-primary-600 transition hover:text-primary-700">
              {t("marketing.signIn", "Sign in")}
            </Link>
          </p>
          <AuthMarketingLinks />
        </AuthCardFooter>
      </div>
    </AuthPageShell>
  )
}
