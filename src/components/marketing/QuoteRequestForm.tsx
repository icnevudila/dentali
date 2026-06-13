"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { submitMarketingLead } from "@/lib/marketing/lead-service"
import { useLocale } from "@/hooks/use-locale"

const BRANCH_OPTIONS = [
  { value: "1", label: "1 branch" },
  { value: "2", label: "2–3 branches" },
  { value: "5", label: "4–5 branches" },
  { value: "10", label: "6+ branches" },
]

export function QuoteRequestForm() {
  const { t } = useLocale()
  const [fullName, setFullName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [clinicName, setClinicName] = React.useState("")
  const [branchCount, setBranchCount] = React.useState("1")
  const [message, setMessage] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [submitted, setSubmitted] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await submitMarketingLead({
      lead_type: "quote",
      full_name: fullName.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      clinic_name: clinicName.trim() || undefined,
      branch_count: Number(branchCount) || undefined,
      message: message.trim() || undefined,
    })

    setLoading(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div
        className="rounded-xl border border-primary-200 bg-primary-50/50 p-8 text-center"
        data-testid="quote-success"
      >
        <h2 className="text-xl font-semibold text-neutral-950">
          {t("quote.successTitle", "Request received")}
        </h2>
        <p className="mt-2 text-sm text-neutral-600">
          {t(
            "quote.successBody",
            "We will email you within one business day with pricing and onboarding options."
          )}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/signup">{t("marketing.startTrial", "Start free trial")}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/welcome">{t("marketing.navHome", "Home")}</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" data-testid="quote-form">
      {error ? (
        <Badge variant="danger" className="w-full justify-center rounded-md py-2">
          {error}
        </Badge>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <label htmlFor="quote-name" className="text-sm font-medium text-neutral-700">
            {t("quote.fullName", "Full name")}
          </label>
          <Input
            id="quote-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="quote-email" className="text-sm font-medium text-neutral-700">
            {t("quote.email", "Work email")}
          </label>
          <Input
            id="quote-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="quote-phone" className="text-sm font-medium text-neutral-700">
            {t("quote.phone", "Mobile (optional)")}
          </label>
          <Input
            id="quote-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+63 …"
            autoComplete="tel"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="quote-clinic" className="text-sm font-medium text-neutral-700">
            {t("quote.clinicName", "Clinic / group name")}
          </label>
          <Input
            id="quote-clinic"
            value={clinicName}
            onChange={(e) => setClinicName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="quote-branches" className="text-sm font-medium text-neutral-700">
            {t("quote.branches", "Number of branches")}
          </label>
          <select
            id="quote-branches"
            value={branchCount}
            onChange={(e) => setBranchCount(e.target.value)}
            className="flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            {BRANCH_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <label htmlFor="quote-message" className="text-sm font-medium text-neutral-700">
            {t("quote.message", "What do you need? (optional)")}
          </label>
          <textarea
            id="quote-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="flex w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            placeholder={t(
              "quote.messagePlaceholder",
              "e.g. HMO billing, 3 branches in QC, migration from spreadsheets…"
            )}
          />
        </div>
      </div>

      <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
        {loading ? t("quote.sending", "Sending…") : t("quote.submit", "Request quote")}
      </Button>
    </form>
  )
}
