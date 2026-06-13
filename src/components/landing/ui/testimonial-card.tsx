"use client"

import * as React from "react"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Testimonial, LandingText } from "@/components/landing/data/landing-data"

interface TestimonialCardProps {
  testimonial: Testimonial
  locale: "en" | "tr"
  className?: string
}

function lt(text: LandingText, locale: "en" | "tr") {
  return text[locale]
}

export function TestimonialCard({ testimonial, locale, className }: TestimonialCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md",
        className
      )}
    >
      {/* Stars */}
      <div className="mb-3 flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              "h-4 w-4",
              i < testimonial.rating
                ? "fill-primary-400 text-primary-400"
                : "fill-neutral-200 text-neutral-200"
            )}
          />
        ))}
      </div>

      {/* Quote */}
      <p className="text-sm leading-relaxed text-neutral-700">
        &ldquo;{lt(testimonial.quote, locale)}&rdquo;
      </p>

      {/* Author */}
      <div className="mt-4 flex items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: testimonial.color }}
        >
          {testimonial.initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-neutral-900">{testimonial.name}</p>
          <p className="truncate text-xs text-neutral-500">
            {testimonial.role} · {testimonial.clinic}
          </p>
        </div>
      </div>
    </div>
  )
}
