"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  acceptStaffInvitation,
  fetchMyBranches,
  fetchMyPermissions,
  fetchStaffProfile,
  logSessionEvent,
} from "@/lib/auth/auth-service"
import { resolvePostLoginPath } from "@/lib/navigation/post-login-route"
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

export default function LoginPage() {
  const { t } = useLocale()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    void (async () => {
      const res = await supabase.auth.getSession()
      const session = res.data?.session
      if (!session) {
        setCheckingSession(false)
        return
      }
      const branches = await fetchMyBranches()
      if (branches.length === 0) {
        router.replace("/onboarding")
        return
      }
      const staff = await fetchStaffProfile()
      const perms = await fetchMyPermissions(branches[0]?.id ?? null)
      router.replace(resolvePostLoginPath({ roleName: staff?.role_name ?? null, permissions: perms }))
      setCheckingSession(false)
    })()
  }, [router, supabase.auth])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    const staff = await fetchStaffProfile()
    if (staff && !staff.is_active) {
      await supabase.auth.signOut()
      setError(t("login.deactivated", "Your account has been deactivated. Contact your clinic administrator."))
      setLoading(false)
      return
    }

    const invite = await acceptStaffInvitation()
    const branches = await fetchMyBranches()
    const needsOnboarding = branches.length === 0
    const perms = await fetchMyPermissions(branches[0]?.id ?? null)
    const homePath = needsOnboarding
      ? "/onboarding"
      : resolvePostLoginPath({ roleName: staff?.role_name ?? null, permissions: perms })

    if (invite.status === "accepted") {
      await logSessionEvent("login")
      router.push(homePath)
      router.refresh()
      return
    }

    if (!needsOnboarding) {
      await logSessionEvent("login")
    }

    router.push(homePath)
    router.refresh()
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-neutral-100">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <AuthPageShell variant="login">
      <div className={authFormCardClassName()}>
        <div className="space-y-2 text-center sm:space-y-2.5">
          <h1 className="font-[family-name:var(--font-clinic-display)] text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
            {t("login.signIn", "Sign in")}
          </h1>
          <p className="text-sm leading-relaxed text-neutral-500">
            {t("login.subtitle", "Sign in to the clinical operating system")}
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error ? <AuthErrorAlert message={error} /> : null}

          <AuthField
            id="login-email"
            label={t("login.email", "Email")}
            type="email"
            placeholder="doctor@clinic.com"
            value={email}
            onChange={setEmail}
            required
            autoComplete="email"
          />
          <AuthPasswordField
            id="login-password"
            label={t("login.password", "Password")}
            value={password}
            onChange={setPassword}
            required
            autoComplete="current-password"
            labelAction={
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-primary-600 transition hover:text-primary-700"
              >
                {t("login.forgotPassword", "Forgot password?")}
              </Link>
            }
          />

          <button type="submit" disabled={loading} className={authPrimaryButtonClassName()}>
            {loading ? t("login.signingIn", "Signing in…") : t("login.signIn", "Sign in")}
          </button>
        </form>

        <AuthCardFooter>
          <p className="text-neutral-500">
            {t("login.newToProduct", "New to dentali.?")}{" "}
            <Link href="/signup" className="font-semibold text-primary-600 transition hover:text-primary-700">
              {t("login.createAccount", "Create clinic account")}
            </Link>
          </p>
          <AuthMarketingLinks />
        </AuthCardFooter>
      </div>
    </AuthPageShell>
  )
}
