"use client"

import * as React from "react"
import Image from "next/image"
import { Check } from "lucide-react"
import { useLocale } from "@/hooks/use-locale"
import {
  CLINIC_EXPERIENCE_ITEMS,
  LANDING_HEADINGS,
  type ClinicExperienceItem,
  type LandingText,
} from "@/components/landing/data/landing-data"
import { LANDING_VIDEOS } from "@/components/landing/data/landing-assets"
import { LandingVideo } from "@/components/landing/ui/landing-video"
import { ScrollReveal } from "@/components/landing/ui/scroll-reveal"
import { cn } from "@/lib/utils"

function lt(text: LandingText, locale: string) {
  return locale === "tr" ? text.tr : text.en
}

/** Tüm kartlarda medya aynı kutuda, ortada */
function MediaSlot({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[220px] w-full max-w-[300px] items-center justify-center sm:min-h-[240px]">
      {children}
    </div>
  )
}

function ExperienceMedia({ item, locale }: { item: ClinicExperienceItem; locale: string }) {
  const video = item.videoKey ? LANDING_VIDEOS[item.videoKey] : null

  if (item.id === "kiosk" && video) {
    return (
      <MediaSlot>
        <div className="landing-zoom-hover-target mx-auto w-full max-w-[300px] overflow-hidden rounded-[20px] border-[6px] border-neutral-800 bg-neutral-900 p-1.5 shadow-lg [transform:none]">
          <div className="landing-video-safe landing-zoom-clip relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-white">
            <LandingVideo
              src={video.src}
              poster={video.poster}
              label={video.alt}
              className="object-center"
            />
          </div>
        </div>
      </MediaSlot>
    )
  }

  if (item.id === "portal" && video) {
    return (
      <MediaSlot>
        <div className="landing-zoom-hover-target relative mx-auto h-[220px] w-auto overflow-hidden rounded-[1.75rem] border-[6px] border-neutral-800 bg-neutral-900 p-1.5 shadow-lg sm:h-[240px] [transform:none]">
          <div
            className="pointer-events-none absolute top-2 left-1/2 z-10 h-2.5 w-12 -translate-x-1/2 rounded-full bg-neutral-900"
            aria-hidden
          />
          <div className="landing-video-safe landing-zoom-clip relative h-full aspect-[9/19] overflow-hidden rounded-[1.15rem] bg-white">
            <LandingVideo src={video.src} poster={video.poster} label={video.alt} className="object-center" />
          </div>
        </div>
      </MediaSlot>
    )
  }

  if (item.id === "queue-tv" && video) {
    return (
      <MediaSlot>
        <div className="landing-zoom-hover-target mx-auto w-full max-w-[300px] overflow-hidden rounded-xl border-[6px] border-neutral-800 bg-neutral-900 p-1.5 shadow-lg [transform:none]">
          <div className="landing-video-safe landing-zoom-clip relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-neutral-950">
            <LandingVideo
              src={video.src}
              poster={video.poster}
              label={video.alt}
              className="object-cover object-center"
            />
          </div>
        </div>
      </MediaSlot>
    )
  }

  if (item.image) {
    return (
      <MediaSlot>
        <div className="landing-zoom-hover-target mx-auto w-full max-w-[300px] overflow-hidden rounded-xl border-[6px] border-neutral-800 bg-neutral-900 p-1.5 shadow-lg">
          <div className="landing-zoom-clip relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-neutral-950">
            <Image
              src={item.image}
              alt={lt(item.title, locale)}
              fill
              className="object-cover object-center"
              sizes="300px"
              priority={false}
            />
          </div>
        </div>
      </MediaSlot>
    )
  }

  return null
}

export function ClinicExperienceSection() {
  const { locale } = useLocale()

  return (
    <section
      id="clinic-experience"
      className="relative scroll-mt-24 overflow-hidden border-y border-neutral-100 bg-white py-14 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-10 max-w-3xl space-y-3 text-center sm:mb-14 sm:space-y-4">
          <ScrollReveal direction="up" delay={100}>
            <span className="inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-700">
              {lt(LANDING_HEADINGS.clinicExperience.eyebrow, locale)}
            </span>
          </ScrollReveal>
          <ScrollReveal direction="up" delay={200}>
            <h2 className="text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
              {lt(LANDING_HEADINGS.clinicExperience.title, locale)}
            </h2>
          </ScrollReveal>
          <ScrollReveal direction="up" delay={300}>
            <p className="text-sm text-neutral-500 sm:text-lg">
              {lt(LANDING_HEADINGS.clinicExperience.subtitle, locale)}
            </p>
          </ScrollReveal>
        </div>

        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 snap-x snap-mandatory scroll-px-4 md:mx-0 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:px-0 md:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CLINIC_EXPERIENCE_ITEMS.map((item, idx) => (
            <article
              key={item.id}
              className={cn(
                "landing-zoom-hover flex h-full w-[min(88vw,320px)] shrink-0 snap-center flex-col rounded-2xl border border-neutral-200/80 bg-neutral-50/40 p-4 sm:p-5 md:w-auto"
              )}
            >
              <div className="mb-4 sm:mb-5">
                <ExperienceMedia item={item} locale={locale} />
              </div>

              <ScrollReveal fadeOnly delay={60 + idx * 50}>
                <div className="flex flex-1 flex-col space-y-2.5 text-center sm:space-y-3">
                  <span className="mx-auto inline-flex rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-600 ring-1 ring-neutral-200">
                    {lt(item.tag, locale)}
                  </span>
                  <h3 className="text-base font-bold leading-snug text-neutral-900 sm:text-lg">
                    {lt(item.title, locale)}
                  </h3>
                  <p className="text-xs leading-relaxed text-neutral-600 sm:text-sm">
                    {lt(item.description, locale)}
                  </p>
                  <ul className="mt-auto space-y-1.5 pt-2 text-left">
                    {item.bullets.map((bullet, bulletIdx) => (
                      <li key={bulletIdx} className="flex items-start gap-2 text-xs text-neutral-700">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-600" />
                        <span>{lt(bullet, locale)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </ScrollReveal>
            </article>
          ))}
        </div>

        <p className="mt-4 text-center text-xs text-neutral-400 md:hidden">
          {locale === "tr" ? "Kaydırarak diğer ekranları görün →" : "Swipe to see more →"}
        </p>
      </div>
    </section>
  )
}
