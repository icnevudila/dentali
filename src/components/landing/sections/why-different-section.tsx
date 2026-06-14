"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ChevronDown, ExternalLink } from "lucide-react"
import { useLocale } from "@/hooks/use-locale"
import { LANDING_DEVICES } from "@/components/landing/data/landing-assets"
import { USP_CARDS, LANDING_HEADINGS, type LandingText, type UspCard } from "@/components/landing/data/landing-data"
import { ScrollReveal } from "@/components/landing/ui/scroll-reveal"
import { cn } from "@/lib/utils"

function lt(text: LandingText, locale: string) {
  return locale === "tr" ? text.tr : text.en
}

const CARD_THEMES = [
  "border-blue-100 bg-blue-50/40",
  "border-teal-100 bg-teal-50/40",
  "border-purple-100 bg-purple-50/40",
  "border-amber-100 bg-amber-50/40",
  "border-emerald-100 bg-emerald-50/40",
  "border-rose-100 bg-rose-50/40",
]

function UspPreviewPanel({ card, locale }: { card: UspCard; locale: string }) {
  if (!card.preview) return null

  if (card.preview.kind === "devices") {
    const labels =
      locale === "tr"
        ? { desktop: "Masaüstü", tablet: "Tablet / kiosk", mobile: "Mobil" }
        : { desktop: "Desktop", tablet: "Tablet / kiosk", mobile: "Mobile" }

    return (
      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        {(
          [
            { key: "desktop" as const, src: LANDING_DEVICES.desktop, aspect: "aspect-[16/10]" },
            { key: "tablet" as const, src: LANDING_DEVICES.tablet, aspect: "aspect-[4/3]" },
            { key: "mobile" as const, src: LANDING_DEVICES.mobile, aspect: "aspect-[9/19]" },
          ] as const
        ).map((device) => (
          <div key={device.key} className="space-y-1.5 text-center">
            <div
              className={cn(
                "relative mx-auto w-full overflow-hidden rounded-lg border-2 border-neutral-800 bg-neutral-900 p-1 shadow-sm",
                device.aspect,
                device.key === "mobile" && "max-w-[72px]"
              )}
            >
              <div className="relative h-full w-full overflow-hidden rounded-[4px] bg-white">
                <Image
                  src={device.src}
                  alt={labels[device.key]}
                  fill
                  className="object-cover object-top"
                  sizes="120px"
                />
              </div>
            </div>
            <p className="text-[10px] font-medium text-neutral-500">{labels[device.key]}</p>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="landing-zoom-clip relative mt-4 aspect-[16/10] w-full overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-inner">
      <Image
        src={card.preview.src}
        alt={lt(card.preview.alt, locale)}
        fill
        className="object-cover object-top"
        sizes="(max-width: 640px) 100vw, 400px"
      />
    </div>
  )
}

export function WhyDifferentSection() {
  const { locale } = useLocale()
  const [openIdx, setOpenIdx] = React.useState<number | null>(null)

  const toggle = (idx: number, hasPreview: boolean) => {
    if (!hasPreview) return
    setOpenIdx((prev) => (prev === idx ? null : idx))
  }

  const seeProduct =
    locale === "tr" ? "Üründen gör" : "See in product"
  const seeFeatures =
    locale === "tr" ? "Özellikler bölümünde aç" : "Open in features"

  return (
    <section id="why-different" className="relative overflow-hidden border-y border-neutral-100 bg-neutral-50/80 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-14 max-w-3xl space-y-4 text-center">
          <ScrollReveal direction="up" delay={100}>
            <span className="inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-700">
              {lt(LANDING_HEADINGS.whyDifferent.eyebrow, locale)}
            </span>
          </ScrollReveal>
          <ScrollReveal direction="up" delay={200}>
            <h2 className="text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-5xl">
              {lt(LANDING_HEADINGS.whyDifferent.title, locale)}
            </h2>
          </ScrollReveal>
          <ScrollReveal direction="up" delay={300}>
            <p className="mx-auto max-w-xl text-lg text-neutral-500">
              {lt(LANDING_HEADINGS.whyDifferent.subtitle, locale)}
            </p>
          </ScrollReveal>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {USP_CARDS.map((card, idx) => {
            const hasPreview = Boolean(card.preview)
            const isOpen = openIdx === idx

            const inner = (
              <>
                {hasPreview ? (
                  <div className="flex justify-end">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-700 ring-1 ring-primary-100",
                        isOpen && "bg-primary-50"
                      )}
                    >
                      {seeProduct}
                      <ChevronDown className={cn("h-3 w-3 transition-transform", isOpen && "rotate-180")} />
                    </span>
                  </div>
                ) : null}
                <h3 className={cn("text-lg font-bold text-neutral-900", hasPreview && "mt-3")}>
                  {lt(card.title, locale)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{lt(card.description, locale)}</p>

                {isOpen && hasPreview ? (
                  <div className="mt-4">
                    <UspPreviewPanel card={card} locale={locale} />
                    {card.featureId ? (
                      <Link
                        href={`#features-${card.featureId}`}
                        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {seeFeatures}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </>
            )

            return (
              <ScrollReveal key={idx} direction="up" delay={60 * idx}>
                {hasPreview ? (
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => toggle(idx, hasPreview)}
                    className={cn(
                      "flex h-full w-full flex-col rounded-2xl border p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
                      CARD_THEMES[idx],
                      isOpen && "ring-2 ring-primary-300 ring-offset-2"
                    )}
                  >
                    {inner}
                  </button>
                ) : (
                  <div
                    className={cn(
                      "flex h-full flex-col rounded-2xl border p-6 shadow-sm",
                      CARD_THEMES[idx]
                    )}
                  >
                    {inner}
                  </div>
                )}
              </ScrollReveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
