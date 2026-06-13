"use client"

import Link from "next/link"
import { QuoteRequestForm } from "@/components/marketing/QuoteRequestForm"
import { useLocale } from "@/hooks/use-locale"

export function QuotePageContent() {
  const { t } = useLocale()

  return (
    <div className="px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-600">
            {t("quotePage.eyebrow", "Sales")}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
            {t("quotePage.title", "Get a quote for your clinic")}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-neutral-600">
            {t(
              "quotePage.subtitle",
              "Tell us about your branches and workflow. We will reply with plan options, migration help, and go-live timing — usually within one business day."
            )}
          </p>
          <ul className="mt-8 space-y-3 text-sm text-neutral-700">
            <li>{t("quotePage.bullet1", "Multi-branch & HMO-heavy clinics")}</li>
            <li>{t("quotePage.bullet2", "Custom integrations (PayMongo, SMS, PhilHealth fields)")}</li>
            <li>{t("quotePage.bullet3", "Staff training and data import from spreadsheets")}</li>
          </ul>
          <p className="mt-8 text-sm text-neutral-500">
            {t("quotePage.readyNow", "Ready to try now?")}{" "}
            <Link href="/signup" className="font-medium text-primary-600 hover:underline">
              {t("marketing.startTrial", "Start free trial")}
            </Link>{" "}
            {t("quotePage.noSalesCall", "— no sales call required for Starter.")}
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <QuoteRequestForm />
        </div>
      </div>
    </div>
  )
}
