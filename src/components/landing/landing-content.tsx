"use client"

import * as React from "react"
import { HeroSection } from "@/components/landing/sections/hero-section"
import { SocialProofStrip } from "@/components/landing/sections/social-proof-strip"
import { ProblemSection } from "@/components/landing/sections/problem-section"
import { ClinicExperienceSection } from "@/components/landing/sections/clinic-experience-section"
import { WhyDifferentSection } from "@/components/landing/sections/why-different-section"
import { FeaturesShowcase } from "@/components/landing/sections/features-showcase"
import { DayInClinic } from "@/components/landing/sections/day-in-clinic"
import { WallOfLove } from "@/components/landing/sections/wall-of-love"
import { FaqSection } from "@/components/landing/sections/faq-section"
import { PricingSummarySection } from "@/components/landing/sections/pricing-summary-section"
import { FinalCta } from "@/components/landing/sections/final-cta"
import { StickyCta } from "@/components/landing/sections/sticky-cta"
import { LandingScrollToTop } from "@/components/landing/ui/landing-scroll-to-top"

import "@/components/landing/landing.css"

export function LandingContent({ showcase }: { showcase?: any }) {
  return (
    <div className="landing-page-root flex min-h-screen flex-col bg-white text-neutral-900">
      {/* 1. Hero Section & Initial CTA */}
      <HeroSection />

      {/* 2. Social Proof Metrics */}
      <SocialProofStrip />

      {/* 3. Pain points → scroll-matched solutions */}
      <ProblemSection />

      {/* 4. Kiosk, portal, TV — clinic-branded demos */}
      <ClinicExperienceSection />

      {/* 5. USP grid */}
      <WhyDifferentSection />

      {/* 6. Sticky/Scroll-driven Feature Showcase */}
      <FeaturesShowcase />

      {/* 7. Chronological timeline (Day in Clinic) */}
      <DayInClinic />

      {/* 8. Testimonials — horizontal scroll strip */}
      <WallOfLove />

      {/* 9. Accordion FAQ list */}
      <FaqSection />

      {/* 10. Pricing summary → full page */}
      <PricingSummarySection />

      {/* 11. Footer CTA banner */}
      <FinalCta />

      <StickyCta />
      <LandingScrollToTop />
    </div>
  )
}
