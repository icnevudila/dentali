"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  acceptStaffInvitation,
  fetchMyBranches,
  fetchStaffProfile,
  logSessionEvent,
} from "@/lib/auth/auth-service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher"
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
    supabase.auth.getSession().then((res: any) => {
      const session = res.data?.session
      if (session) router.replace("/")
      setCheckingSession(false)
    })
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
    if (invite.status === "accepted") {
      await logSessionEvent("login")
      router.push("/")
      router.refresh()
      return
    }

    const branches = await fetchMyBranches()
    const needsOnboarding = branches.length === 0

    if (!needsOnboarding) {
      await logSessionEvent("login")
    }

    router.push(needsOnboarding ? "/onboarding" : "/")
    router.refresh()
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-white overflow-hidden">
      {/* Background decoration */}
      <div className="landing-hero-bg absolute inset-0 pointer-events-none opacity-40" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 max-w-6xl w-full mx-auto">
        <Link href="/welcome" className="text-xl font-bold tracking-tight text-neutral-900">
          dentali<span className="text-primary-600">.</span>
        </Link>
        <LocaleSwitcher />
      </header>

      {/* Form Container */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 pb-12">
        <div className="w-full max-w-[440px] space-y-8 rounded-3xl border border-neutral-100 bg-white/80 p-8 shadow-xl backdrop-blur-md">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">
              dentali<span className="text-primary-600">.</span>
            </h1>
            <p className="text-sm font-medium text-neutral-500">
              {t("login.subtitle", "Sign in to the clinical operating system")}
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-center text-xs font-semibold text-red-600">
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                {t("login.email", "Email")}
              </label>
              <input
                id="login-email"
                type="email"
                placeholder="doctor@clinic.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none placeholder-neutral-400 transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label htmlFor="login-password" className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  {t("login.password", "Password")}
                </label>
              </div>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary-600 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-500/20 transition duration-200 hover:bg-primary-700 active:scale-98 disabled:opacity-50"
            >
              {loading ? t("login.signingIn", "Signing in…") : t("login.signIn", "Sign in")}
            </button>
          </form>

          <div className="space-y-3 pt-2 text-center text-sm">
            <p className="text-neutral-500">
              {t("login.newToProduct", "New to dentali.?")}{" "}
              <Link href="/signup" className="font-bold text-primary-600 hover:text-primary-700 transition">
                {t("login.createAccount", "Create clinic account")}
              </Link>
            </p>
            <div className="flex justify-center gap-4 text-xs font-semibold text-neutral-500 border-t border-neutral-100 pt-4">
              <Link href="/quote" className="hover:text-primary-600 transition">
                {t("login.requestQuote", "Request a quote")}
              </Link>
              <span>·</span>
              <Link href="/welcome" className="hover:text-primary-600 transition">
                {t("login.learnMore", "Learn more")}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-neutral-100 bg-white py-6 text-center text-xs font-semibold text-neutral-500">
        <div className="max-w-6xl mx-auto flex justify-center gap-6">
          <Link href="/pricing" className="hover:text-primary-600 transition">
            {t("marketing.navPricing", "Pricing")}
          </Link>
          <Link href="/quote" className="hover:text-primary-600 transition">
            {t("marketing.navQuote", "Get a quote")}
          </Link>
          <Link href="/welcome" className="hover:text-primary-600 transition">
            {t("marketing.navHome", "Home")}
          </Link>
        </div>
      </footer>
    </div>
  )
}
