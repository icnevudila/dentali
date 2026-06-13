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
    supabase.auth.getSession().then(({ data: { session } }) => {
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
    <div className="flex min-h-screen flex-col bg-neutral-50 px-4">
      <header className="flex items-center justify-between py-4">
        <Link href="/welcome" className="text-lg font-bold tracking-tight text-primary-600">
          dentali.
        </Link>
        <LocaleSwitcher />
      </header>
      <div className="flex flex-1 items-center justify-center pb-10">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-3xl font-bold tracking-tight text-primary-600">
            dentali.
          </CardTitle>
          <p className="text-sm text-neutral-500">
            {t("login.subtitle", "Sign in to the clinical operating system")}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <Badge variant="danger" className="w-full justify-center rounded-md py-2">
                {error}
              </Badge>
            )}
            <div className="space-y-2">
              <label htmlFor="login-email" className="text-sm font-medium leading-none text-neutral-700">
                {t("login.email", "Email")}
              </label>
              <Input
                id="login-email"
                type="email"
                placeholder="doctor@clinic.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="login-password" className="text-sm font-medium leading-none text-neutral-700">
                {t("login.password", "Password")}
              </label>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("login.signingIn", "Signing in…") : t("login.signIn", "Sign in")}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-neutral-500">
            {t("login.newToProduct", "New to dentali.?")}{" "}
            <Link href="/signup" className="font-medium text-primary-600 hover:underline">
              {t("login.createAccount", "Create clinic account")}
            </Link>
          </p>
          <p className="mt-3 text-center text-sm text-neutral-500">
            <Link href="/quote" className="font-medium text-primary-600 hover:underline">
              {t("login.requestQuote", "Request a demo or quote")}
            </Link>
            {" · "}
            <Link href="/welcome" className="font-medium text-primary-600 hover:underline">
              {t("login.learnMore", "See what the clinic OS includes")}
            </Link>
          </p>
        </CardContent>
      </Card>
      </div>
      <footer className="border-t border-neutral-200 py-6 text-center text-xs text-neutral-500">
        <Link href="/pricing" className="hover:text-primary-700">
          {t("marketing.navPricing", "Pricing")}
        </Link>
        {" · "}
        <Link href="/quote" className="hover:text-primary-700">
          {t("marketing.navQuote", "Get a quote")}
        </Link>
        {" · "}
        <Link href="/welcome" className="hover:text-primary-700">
          {t("marketing.navHome", "Home")}
        </Link>
      </footer>
    </div>
  )
}
