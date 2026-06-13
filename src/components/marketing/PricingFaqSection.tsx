import { getSiteUrl } from "@/lib/site-url"

const FAQ_ITEMS = [
  {
    question: "Is dentali. built for Philippine clinics?",
    answer:
      "Yes. Branch-aware workflows, HMO and PhilHealth-ready billing fields, kiosk check-in, queue display, and digital consent are designed for Metro Manila and provincial multi-branch groups.",
  },
  {
    question: "Can I start without a sales call?",
    answer:
      "Starter and Growth plans include a free trial. Create an account, run onboarding, and invite staff. Enterprise groups can request a quote for migration and custom integrations.",
  },
  {
    question: "What is included in every plan?",
    answer:
      "Patient registry, dental chart, appointments, queue board, billing, consent templates, kiosk links, and TV display — the full clinical workflow from front desk to chair side.",
  },
  {
    question: "How does multi-branch pricing work?",
    answer:
      "Growth covers multiple branches under one organization. Enterprise pricing is custom based on branch count, integrations (PayMongo, SMS), and onboarding support.",
  },
] as const

export function PricingFaqSection() {
  const siteUrl = getSiteUrl()

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  }

  return (
    <section className="mt-16 border-t border-neutral-200 pt-12" aria-labelledby="pricing-faq">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <h2 id="pricing-faq" className="text-center text-2xl font-semibold tracking-tight text-neutral-950">
        Frequently asked questions
      </h2>
      <dl className="mx-auto mt-8 max-w-2xl space-y-6">
        {FAQ_ITEMS.map((item) => (
          <div key={item.question}>
            <dt className="text-sm font-semibold text-neutral-900">{item.question}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-neutral-600">{item.answer}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-8 text-center text-xs text-neutral-400">
        More details at{" "}
        <a href={`${siteUrl}/welcome`} className="text-primary-600 hover:underline">
          {siteUrl.replace(/^https?:\/\//, "")}/welcome
        </a>
      </p>
    </section>
  )
}
