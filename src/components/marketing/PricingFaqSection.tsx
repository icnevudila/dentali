"use client"

import { getSiteUrl } from "@/lib/site-url"
import { useLocale } from "@/hooks/use-locale"

export function PricingFaqSection() {
  const { t } = useLocale()
  const siteUrl = getSiteUrl()

  const faqItems = [
    {
      q: t("pricingFaq.q1", "Is dentali. built for Philippine clinics?"),
      a: t(
        "pricingFaq.a1",
        "Yes. Branch-aware workflows, HMO and PhilHealth-ready billing fields, kiosk check-in, queue display, and digital consent are designed for Metro Manila and provincial multi-branch groups."
      ),
    },
    {
      q: t("pricingFaq.q2", "Can I start without a sales call?"),
      a: t(
        "pricingFaq.a2",
        "Starter and Growth plans include a free trial. Create an account, run onboarding, and invite staff. Enterprise groups can request a quote for migration and custom integrations."
      ),
    },
    {
      q: t("pricingFaq.q3", "What is included in every plan?"),
      a: t(
        "pricingFaq.a3",
        "Patient registry, dental chart, appointments, queue board, billing, consent templates, kiosk links, and TV display — the full clinical workflow from front desk to chair side."
      ),
    },
    {
      q: t("pricingFaq.q4", "How does multi-branch pricing work?"),
      a: t(
        "pricingFaq.a4",
        "Growth covers multiple branches under one organization. Enterprise pricing is custom based on branch count, integrations (PayMongo, SMS), and onboarding support."
      ),
    },
  ]

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  }

  return (
    <section className="mt-16 border-t border-neutral-200 pt-12" aria-labelledby="pricing-faq">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <h2 id="pricing-faq" className="text-center text-2xl font-semibold tracking-tight text-neutral-950">
        {t("pricingFaq.title", "Frequently asked questions")}
      </h2>
      <dl className="mx-auto mt-8 max-w-2xl space-y-6">
        {faqItems.map((item) => (
          <div key={item.q}>
            <dt className="text-sm font-semibold text-neutral-900">{item.q}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-neutral-600">{item.a}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-8 text-center text-xs text-neutral-400">
        {t("pricingFaq.moreDetails", "More details at")}{" "}
        <a href={`${siteUrl}/welcome`} className="text-primary-600 hover:underline">
          {siteUrl.replace(/^https?:\/\//, "")}/welcome
        </a>
      </p>
    </section>
  )
}
