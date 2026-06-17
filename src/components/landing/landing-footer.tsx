"use client"

import * as React from "react"
import Link from "next/link"
import { useLocale } from "@/hooks/use-locale"
import { DentQLLogo } from "@/components/brand/dentql-logo"
import { BRAND_NAME } from "@/lib/brand"
import { LANDING_HEADINGS, type LandingText } from "@/components/landing/data/landing-data"

function lt(text: LandingText, locale: string) {
  return locale === "tr" ? text.tr : text.en
}

export function LandingFooter() {
  const { locale, setLocale } = useLocale()
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-neutral-100 bg-white py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 pb-12">
          
          {/* Logo & Slogan Column */}
          <div className="md:col-span-5 space-y-4">
            <DentQLLogo href="/" size="md" />
            <p className="text-sm text-neutral-500 max-w-sm">
              {lt(LANDING_HEADINGS.footer.slogan, locale)}
            </p>
            
            {/* Language Switcher */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setLocale("en")}
                className={`px-3 py-1 text-xs rounded-full border transition-all ${
                  locale === "en"
                    ? "border-primary-500 bg-primary-50 text-primary-700 font-bold"
                    : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                English
              </button>
              <button
                onClick={() => setLocale("tr")}
                className={`px-3 py-1 text-xs rounded-full border transition-all ${
                  locale === "tr"
                    ? "border-primary-500 bg-primary-50 text-primary-700 font-bold"
                    : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                Türkçe
              </button>
            </div>
          </div>

          {/* Links Columns */}
          <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8">
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-neutral-950 uppercase tracking-wider">
                {lt(LANDING_HEADINGS.footer.productTitle, locale)}
              </h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <Link href="/welcome#features" className="text-neutral-600 hover:text-primary-600 transition">
                    {lt(LANDING_HEADINGS.footer.featuresLink, locale)}
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="text-neutral-600 hover:text-primary-600 transition">
                    {lt(LANDING_HEADINGS.footer.pricingLink, locale)}
                  </Link>
                </li>
                <li>
                  <Link href="/security" className="text-neutral-600 hover:text-primary-600 transition">
                    {lt(LANDING_HEADINGS.footer.securityLink, locale)}
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-bold text-neutral-950 uppercase tracking-wider">
                {lt(LANDING_HEADINGS.footer.companyTitle, locale)}
              </h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <Link href="/about" className="text-neutral-600 hover:text-primary-600 transition">
                    {lt(LANDING_HEADINGS.footer.aboutLink, locale)}
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="text-neutral-600 hover:text-primary-600 transition">
                    {lt(LANDING_HEADINGS.footer.contactLink, locale)}
                  </Link>
                </li>
                <li>
                  <Link href="/blog" className="text-neutral-600 hover:text-primary-600 transition">
                    {lt(LANDING_HEADINGS.footer.blogLink, locale)}
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-4 col-span-2 sm:col-span-1">
              <h4 className="text-sm font-bold text-neutral-950 uppercase tracking-wider">
                {lt(LANDING_HEADINGS.footer.legalTitle, locale)}
              </h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <Link href="/privacy" className="text-neutral-600 hover:text-primary-600 transition">
                    {lt(LANDING_HEADINGS.footer.privacyLink, locale)}
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-neutral-600 hover:text-primary-600 transition">
                    {lt(LANDING_HEADINGS.footer.termsLink, locale)}
                  </Link>
                </li>
              </ul>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-neutral-100 pt-8 text-xs text-neutral-500 sm:flex-row">
          <p>© {currentYear} {BRAND_NAME}. All rights reserved.</p>
          <p>{lt(LANDING_HEADINGS.footer.tagline, locale)}</p>
        </div>

      </div>
    </footer>
  )
}
